var _f = require('underscore-functions');
var _a = require('worker_threads'), isMainThread = _a.isMainThread, parentPort = _a.parentPort, workerData = _a.workerData;
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
        if (opts) {
            this._opts = Object.assign(this._opts, opts);
        }
        if (tasks) {
            tasks.forEach(function (task, index) {
                return index === tasks.length ? _this.add(task, true) : _this.add(task);
            });
        }
    }
    MoxyTaskScheduler.prototype.start = function () {
        var _this = this;
        this._monitor();
        this._masterThread = setInterval(function () { return _this._monitor(); }, this._opts.idleCooldown);
        return true;
    };
    MoxyTaskScheduler.prototype.stop = function () {
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
    MoxyTaskScheduler.prototype.add = function (task, interrupt) {
        if (interrupt === void 0) { interrupt = false; }
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
        if (interrupt) {
            this.sort();
        }
        return true;
    };
    MoxyTaskScheduler.prototype.remove = function (labelOrId, date) {
        var task = this._tasks.find(function (task) {
            return task._id === labelOrId || task.label === labelOrId;
        });
        if (task) {
            if (date) {
                var d_1 = task.schedule.findIndex(function (d) { return d === date; });
                task.schedule = task.schedule.filter(function (date, index) { return index !== d_1; });
            }
            else {
                this._tasks = this._tasks.filter(function (t) { return t._id !== task._id; });
            }
            return true;
        }
        return false;
    };
    MoxyTaskScheduler.prototype.rewind = function () {
        this._queuePointer = 0;
        return true;
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
        this._tasks.sort(function (a, b) {
            return (a.priority || 0) > (b.priority || 0) ? -1 : 1;
        });
        this.rewind();
        return true;
    };
    MoxyTaskScheduler.prototype.sortSchedule = function (task) {
        var _a;
        (_a = task.schedule) === null || _a === void 0 ? void 0 : _a.sort(function (a, b) {
            return a.valueOf() < b.valueOf() ? -1 : 1;
        });
        return true;
    };
    MoxyTaskScheduler.prototype.errorLogs = function () {
        return this._errors;
    };
    MoxyTaskScheduler.prototype._monitor = function () {
        var d = new Date().valueOf();
        if (!this._tasks || this._tasks.length === 0) {
            if (this._opts.stopAfterEmptyQueue) {
                this.stop();
            }
            return false;
        }
        var _loop_1 = function (i) {
            var job = this_1._tasks[this_1._queuePointer];
            if (d > job.schedule[0].valueOf()) {
                var schedule = job.schedule.shift();
                if (job.cron) {
                    var time = schedule.valueOf();
                    time +=
                        job.cron.units === 'seconds'
                            ? job.cron.interval * 1000
                            : job.cron.units === 'minutes'
                                ? job.cron.interval * 1000 * 60
                                : job.cron.units === 'hours'
                                    ? job.cron.interval * 1000 * 60 * 60
                                    : job.cron.units === 'days'
                                        ? job.cron.interval * 1000 * 60 * 60 * 24
                                        : job.cron.units === 'weeks'
                                            ? job.cron.interval * 1000 * 60 * 60 * 24 * 7
                                            : job.cron.interval * 1000; // default to seconds
                    var d_2 = new Date(time);
                    job.schedule.push(d_2); // Ensures cron runs indefinitely
                }
                this_1._execute(job);
                if (job && job.schedule.length === 0) {
                    this_1._tasks = this_1._tasks.filter(function (task) { return task._id !== job._id; });
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
    MoxyTaskScheduler.prototype._execute = function (job) {
        if (typeof job.task === 'function') {
            var retries_1 = 0;
            try {
                var ret = job.task();
                // Retry due to failure
                if (!ret && job.retryLimit) {
                    var retryTimer_1 = setInterval(function () {
                        var ret = job.task();
                        retries_1++;
                        if (ret || retries_1 >= (job.retryLimit || 0)) {
                            clearInterval(retryTimer_1);
                        }
                    }, job.retryInterval);
                }
            }
            catch (e) {
                this._errors[this._errors.length] = {
                    error: e,
                    isWorker: false,
                    jobId: job._id,
                    label: job.label,
                    timestamp: new Date()
                };
            }
        }
        else {
            // Worker thread
            this._workers[this._workers.length] = Object.assign({}, job);
            var instance = this._workers[this._workers.length - 1];
            try {
                instance.worker = new Worker(instance.task, instance.workerOpts);
                if (instance.workerInit) {
                    instance.workerInit(instance.worker); // run initializer
                }
            }
            catch (e) {
                this._errors[this._errors.length] = {
                    error: e,
                    isWorker: true,
                    jobId: instance._id,
                    label: instance.label,
                    timestamp: new Date()
                };
            }
        }
        return true;
    };
    return MoxyTaskScheduler;
}());
module.exports = MoxyTaskScheduler;
