//     crawler example
//     (c) 2014 vadim b. antheworld@gmail.com
//     license: MIT
(function () {

    var spawn = require('child_process').spawn,
        http = require('http'),
        fs = require('fs'),
        processor = require('processor'),
        com = processor.create;
    // using
    require('com-fs');


    function WebCrawler(parameters, args) { "use strict";
        var crawler = this;

        // defaults
        args = extend({
            max_agents:         1,
            max_threads:        2,
            max_fails:          5,
            timeout:            40000,
            start_interval:     250,
            wait_page_rendered: 250,
            // injected resources
            resources_inject:   [],
            // injected code
            inject: 'function inject() {}',
            debug_inject: false,
            debug_agent: false,
            dev_tools: false
        }, args);

        this.initialize('webcrawler', parameters, args);

        var queue  = [],                // queued tasks
            id_gen = 100,
            by_id  = this.by_id  = {},  // tasks by id
            by_url = this.by_url = {};  // tasks by url

        this.task_count = 0;
        this.paused = false;            // pause tasks execution
        this.started = false;

        // validate crawler options
        this.validateArguments = function() {

            var args = this.arguments;

            if (!args.wait_page_rendered)
                args.wait_page_rendered = 20;

            if (typeof args.urls === 'string')
                args.urls = args.urls.split(/ |,/g);

            if (!Array.isArray(args.urls))
                args.urls = [];

            if (!args.resources_inject)
                args.resources_inject = [];
            else if (!Array.isArray(args.resources_inject))
                args.resources_inject = [args.resources_inject];

            if (!args.inject)
                args.inject = 'function inject() {}';
            else if (typeof args.inject !== 'string')
                args.inject = String(args.inject);
        };

        this.validateArguments();

        var dispatcher = new Dispatcher();

        var timer, last_started = 0;
        function tick() {

            var now = Date.now(),
                args = this.arguments,
                tasks_count = dispatcher.count();

            // check queue and start task
            if (queue.length) {

                if (!this.paused
                && last_started < now - args.start_interval
                && tasks_count < args.max_agents * args.max_threads) {
                    dispatcher.startTask(queue.pop());
                    last_started = now;
                }

            // check all tasks done
            } else if (!tasks_count) {
                this.stop();
                this.raise('done', this);
            }

            // check active tasks
            dispatcher.tick(queue);
        }

        // pause crawling
        this.pause = function() {
            this.paused = true;
        };

        // resume crawling
        this.resume = function() {
            this.paused = false;
        };

        // stop all tasks
        this.stop = function() {

            if (timer)
                clearInterval(timer);

            queue.length = 0;
            dispatcher.stop();
            this.started = false;
        };



        // enqueue task if not exists task with this url
        this.enqueueUrl = function(url) {

            if (!(url in by_url)) {

                //check +-'/' alias
                var alias = (url.slice(-1) === '/') ? url.slice(0, -1) : (url + '/');

                if (!(alias in by_url)) {
                    var task = {
                        url:    url,
                        id:     (++id_gen).toString(),
                        state:  0,  // текущее состояние задачи, < 0 ошибки. -1 fail, -2 timeout
                        fails:  0,
                        data:   {}  // сессионные данные
                    };
                    by_id[task.id] = task;
                    by_url[task.url] = task;

                    this.raise('task', task);

                    queue.push(task);
                    this.task_count++;

                    return task;
                }
            }
        };

        // enqueue url without check
        this.enqueueTask = function(url) {
            var task = {
                url:    url,
                id:     (++id_gen).toString(),
                state:  0,  // текущее состояние задачи, < 0 ошибки
                fails:  0,
                data:   {}  // сессионные данные
            };
            by_id[task.id] = task;
            by_url[task.url] = task;

            this.raise('task', task);

            queue.push(task);
            this.task_count++;

            return task;
        };

        var controller_port;
        this.start = function() {

            // http server collect data from all frames

            if (!controller_port) {

                this.arguments.controller_port
                    = controller_port
                        = ('5' + Math.random().toString().slice(-4));

                var server = http.createServer(function(req, res) {

                    var url_match;
                    if (url_match = /^\/\?tid=(\S+?)&win=(.*?)&data=(.*)/.exec(req.url)) {

                        // extract data sended from web pages

                        var tid = url_match[1],
                            win = decodeURIComponent(url_match[2]),
                            data = JSON.parse(decodeURIComponent(url_match[3])),
                            task = by_id[tid];
                        if (task && win) {
                            // task data
                            task.data[win] = data;
                            crawler.raise('callback', task, win);
                        }

                    } else if (url_match = /^\/\?pid=(\S+)/.exec(req.url)) {

                        // periodic polling

                        dispatcher.polling(url_match[1], res);

                    } else if (url_match = /\/[^?#&]+/.exec(req.url)) {

                        // try to find resource

                        try {
                            res.writeHead(200, { 'Content-Type': 'application/javascript' });
                            res.write( fs.readFileSync('.' + url_match[0]) );
                        } catch (e) {
                            console.log(e);
                        }

                    } else {
                        // debug:
                        console.log('not recognized ' + req.url);
                    }

                    res.end();
                });

                server.on('error', function() {
                    controller_port = undefined;
                    this.stop();
                    this.raise('error', arguments);
                });

                 server.listen(controller_port);
            }

            this.arguments.urls.forEach(function(url) {
                this.enqueueTask(url);
            }, this);

            // start timer

            if (!timer)
                timer = setInterval(tick.bind(this), 250);

            this.started = true;
        };






        function agentController() {

            this.pid = Math.random().toString().slice(10);
            this.tasks = [];

            var last_connection = Date.now(),
                message_queue = [],
                agent_process,
                fs_directory = com('fs.dir');

            this.polling = function(response) {
                last_connection = Date.now();
                var msg;
                if (msg = message_queue.shift()) {
                    response.write(JSON.stringify(msg));
                }
            };

            // queue message
            this.send = function(data) {
                message_queue.push(data);
            };

            // close agent process
            this.kill = function() {

                if (this.tasks.length)
                    throw new TypeError('Trying to kill process having unfinished tasks');

                message_queue.length = 0;

                // kill process
                if (agent_process) {
                    agent_process.kill();
                    agent_process = undefined;
                }

                // wait for temporary directory unlocked
                var check_for_remove_path = 'temp/' + this.pid;
                setTimeout(function() { try { fs_directory.unsafeRemoveSync(check_for_remove_path); } catch (e) {} }.bind(this), 3500);

                // renew pid
                this.pid = Math.random().toString().slice(10);
            };

            // remove tasks and kill process
            this.stop = function(requeue_tasks) {
                var task;
                while(task = this.tasks.pop()) {
                    if (requeue_tasks) {
                        task.state = 0;
                        queue.push(task);
                    } else {
                        task.state = -1;
                        task.fails++;
                    }
                    task.started = undefined;
                }
                this.kill();
            };

            this.startTask = function(task) {

                crawler.validateArguments();

                var now = Date.now(),
                    args = crawler.arguments;

                // kill process on timeout
                if (last_connection < now - args.timeout)
                    this.stop(true);

                if (!agent_process) {

                    var cmd_args =
                        ['--url=app://./crawler-agent.html?port=' + args.controller_port +  '&pid=' + this.pid,
                        '--data-path=temp/' + this.pid + '/',
                        '--js-flags=--harmony'];

                    if (args.dev_tools || args.debug_agent)
                        cmd_args.push('--dev-tools');

                    if (args.debug_agent)
                        cmd_args.push('--debug-brk')

                    // --no-toolbar
                    agent_process = spawn(process.execPath, cmd_args);

                    agent_process.on('close', function() {
                        this.stop(true);
                    }.bind(this));

                    this.send(args);

                    last_connection = now;
                }

                task.started = now; // start time
                task.state = 0;
                this.tasks.push(task);
                this.send({ command: 'task', task: task });
            };

            this.removeTask = function(task) {
                var index = this.tasks.indexOf(task);
                if (index >= 0) {
                    this.send({ command: 'remove', id: task.id })
                    this.tasks.splice(index, 1);
                    return task;
                }
            };
        }

        function Dispatcher() {

            var agents = [];    // processes

            this.polling = function(pid, response) {
                for(var i = 0, c = agents.length; i < c; i++) {
                    var agent = agents[i];
                    if (agent.pid === pid)
                        agent.polling(response);
                }
            };

            // Overall task count
            this.count = function() {
                return agents.reduce(function(prev, agent) { return prev + agent.tasks.length; }, 0);
            };

            this.tick = function(queue) {
                var now = Date.now(),
                    args = crawler.arguments;

                agents.forEach(function(agent) {
                    agent.tasks.forEach(function(task) {
                        if (task.state) {
                            return this.removeTask(task);
                        } else if (task.started + args.timeout < now) {
                            // task timeout
                            task.state = -2; // timeout
                            task.fails++;
                            if (task.fails < args.max_fails)
                                queue.push(task);
                            return this.removeTask(task);
                        }
                    }, this);
                }, this);
            };

            // start task
            this.startTask = function(task) {

                var args = crawler.arguments;

                // При старте первой задачи создается пул процессов
                if (!agents.length) {
                    while(agents.length < args.max_agents) {
                        var agent_controller = new agentController();
                        this[agent_controller.pid] = agent_controller;
                        agents.push(agent_controller);
                    }
                }

                for(var i = 0, c = agents.length; i < c; i++) {
                    var agent = agents[i];
                    if (agent.tasks.length < args.max_threads) {
                        agent.startTask(task);
                        break;
                    }
                }
            };

            this.removeTask = function(task) {
                if (agents.some(function(agent) { return agent.removeTask(task); }))
                    return task;
            }

            this.stop = function(requeue_tasks) {
                var agent;
                while(agent = agents.pop())
                    agent.stop(requeue_tasks);
            };
        }

        function extend(object) {
            for(var i = 1, c = arguments.length; i < c; i++) {
                var src = arguments[i];
                if (typeof src === 'object')
                for(var prop in src)
                if (src.hasOwnProperty(prop))
                    object[prop] = src[prop];
            }
            return object;
        }
    }
    WebCrawler.prototype = new processor.com_prototype();
    processor.typeRegister('webcrawler', WebCrawler);

})();