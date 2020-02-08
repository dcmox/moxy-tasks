"use strict";
exports.__esModule = true;
var _f = require('underscore-functions')._f;
var _a = require('worker_threads'), Worker = _a.Worker, isMainThread = _a.isMainThread, parentPort = _a.parentPort, workerData = _a.workerData;
var MoxyTaskScheduler = /** @class */ (function () {
    function MoxyTaskScheduler(tasks, opts) {
        var _this = this;
        this._tasks = [];
        this._workers = [];
        this._defaultRetryinterval = 6000;
        this._masterThread = null;
        this._queuePointer = 0;
        this._errors = [];
        this._opts = {
            defaultTime: 1,
            idleCooldown: 2000,
            stopAfterEmptyQueue: false,
            taskLimit: 100,
            tasksPerIdle: 2
        };
        if (tasks) {
            tasks.forEach(function (task) { return _this.add(task); });
        }
        if (opts) {
            this._opts = Object.assign(this._opts, opts);
        }
    }
    MoxyTaskScheduler.prototype.start = function () {
        var _this = this;
        this._process();
        this._masterThread = setInterval(function () { return _this._process(); }, this._opts.idleCooldown);
        return true;
    };
    MoxyTaskScheduler.prototype.stop = function () {
        console.log('Stopping...');
        this._workers.forEach(function (task) {
            if (task.workerTask) {
                task.workerTask.terminate();
            }
        });
        clearInterval(this._masterThread);
        return true;
    };
    MoxyTaskScheduler.prototype.getTasks = function () {
        return this._tasks;
    };
    MoxyTaskScheduler.prototype.getWorkers = function () {
        return this._workers;
    };
    MoxyTaskScheduler.prototype.add = function (task) {
        if (!task.created) {
            task.created = new Date();
        }
        if (!task._id) {
            task._id = _f.uniqueId();
        }
        if (!task.priority) {
            task.priority = (this._opts.taskLimit || 100) - this._tasks.length;
        }
        if (!task.retryLimit) {
            task.retryLimit = 0;
        }
        if (task.retryLimit && !task.retryInterval) {
            task.retryInterval = this._defaultRetryinterval;
        }
        if (!task.schedule) {
            task.schedule = [];
        }
        if (task.schedule.length === 0) {
            var d = new Date();
            d.setMinutes(d.getMinutes() + (this._opts.defaultTime || 0));
            task.schedule.push(d);
        }
        else {
            this.sortSchedule(task);
        }
        this._tasks[this._tasks.length] = task;
        this.sort();
        return true;
    };
    MoxyTaskScheduler.prototype.remove = function (labelOrId, date) {
        var task = this._tasks.find(function (task) { return task._id === labelOrId || task.label === labelOrId; });
        if (task) {
            if (date) {
                var d = task.schedule.find(function (d) { return d === date; });
                if (d) {
                    d = undefined;
                }
                else {
                    return false;
                }
                task.schedule = task.schedule.filter(function (d) { return d; });
            }
            else {
                task = undefined;
                this._tasks = this._tasks.filter(function (t) { return t; });
            }
            return true;
        }
        return false;
    };
    MoxyTaskScheduler.prototype.next = function () {
        this._queuePointer++;
        if (this._queuePointer > this._tasks.length - 1) {
            this._queuePointer = 0;
        }
        return true;
    };
    MoxyTaskScheduler.prototype.previous = function () {
        this._queuePointer--;
        if (this._queuePointer < 0) {
            this._queuePointer = 0;
        }
        return true;
    };
    MoxyTaskScheduler.prototype.peek = function () {
        return this._tasks[this._queuePointer + 1] || this._tasks[0];
    };
    MoxyTaskScheduler.prototype.sort = function () {
        this._tasks.sort(function (a, b) { return (a.priority || 0) > (b.priority || 0) ? -1 : 1; });
        return true;
    };
    MoxyTaskScheduler.prototype.sortSchedule = function (task) {
        var _a;
        (_a = task.schedule) === null || _a === void 0 ? void 0 : _a.sort(function (a, b) { return a.valueOf() < b.valueOf() ? -1 : 1; });
        return true;
    };
    MoxyTaskScheduler.prototype.errorLogs = function () {
        return this._errors;
    };
    MoxyTaskScheduler.prototype._process = function () {
        var d = new Date().valueOf();
        if (!this._tasks || this._tasks.length === 0) {
            if (this._opts.stopAfterEmptyQueue) {
                this.stop();
            }
            return false;
        }
        var _loop_1 = function (i) {
            if (d > this_1._tasks[this_1._queuePointer].schedule[0].valueOf()) {
                this_1._tasks[this_1._queuePointer].schedule.shift();
                if (typeof this_1._tasks[this_1._queuePointer].task === 'function') {
                    var retries_1 = 0;
                    var job_1 = this_1._tasks[this_1._queuePointer];
                    try {
                        var ret = job_1.task();
                        // Retry due to failure
                        if (!ret && job_1.retryLimit) {
                            var retryTimer_1 = setInterval(function () {
                                var ret = job_1.task();
                                retries_1++;
                                if (ret || retries_1 >= job_1.retryLimit) {
                                    clearInterval(retryTimer_1);
                                }
                            }, job_1.retryInterval);
                        }
                    }
                    catch (e) {
                        this_1._errors[this_1._errors.length] = {
                            error: e,
                            isWorker: false,
                            jobId: job_1._id,
                            label: job_1.label,
                            timestamp: new Date()
                        };
                    }
                }
                else {
                    // Worker thread
                    var job = this_1._tasks[this_1._queuePointer];
                    this_1._workers[this_1._workers.length] = Object.assign({}, job);
                    var instance = this_1._workers[this_1._workers.length - 1];
                    try {
                        instance.worker = new Worker(instance.task, instance.workerOpts);
                        if (instance.workerInit) {
                            instance.workerInit(instance.worker); // run initializer
                        }
                    }
                    catch (e) {
                        this_1._errors[this_1._errors.length] = {
                            error: e,
                            isWorker: true,
                            jobId: instance._id,
                            label: instance.label,
                            timestamp: new Date()
                        };
                    }
                }
                if (this_1._tasks[this_1._queuePointer] && this_1._tasks[this_1._queuePointer].schedule.length === 0) {
                    this_1._tasks[this_1._queuePointer] = undefined;
                    this_1._tasks = this_1._tasks.filter(function (t) { return t; });
                }
            }
            else {
                // Waiting
            }
            this_1.next();
            if (!this_1._tasks[this_1._queuePointer]) {
                return "break";
            }
        };
        var this_1 = this;
        for (var i = 0; i < (this._opts.tasksPerIdle || 2); i++) {
            var state_1 = _loop_1(i);
            if (state_1 === "break")
                break;
        }
        return true;
    };
    return MoxyTaskScheduler;
}());
exports.MoxyTaskScheduler = MoxyTaskScheduler;
