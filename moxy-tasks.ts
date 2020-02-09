const _f = require('underscore-functions')._f
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads')

interface IMoxyTask {
    _id?: string
    label: string,
    created?: Date,
    priority?: number,
    retryLimit?: number,
    retryInterval?: number,
    schedule?: Date[],
    cron?: IMoxyCronOptions,
    task: (() => boolean) | string, // Worker path
    workerInit?: (worker: Worker) => any,
    workerTask?: any, // Should not be initialized
    workerOpts?: any
}

interface IMoxyCronOptions {
    unit?: string, //"seconds" | "minutes" | "hours" | "days" | "weeks"
    interval: number
}

interface IMoxyTaskSchedulerOptions {
    defaultTime?: number, // Default time in minutes task will run if no scheduled dates
    idleCooldown?: number,
    stopAfterEmptyQueue?: boolean,
    taskLimit?: number,
    tasksPerIdle?: number,
}

export class MoxyTaskScheduler {
    private _tasks: any[] = []
    private _workers: any[] = []
    private _defaultRetryinterval: number = 6000
    private _masterThread: any = null
    private _queuePointer: number = 0
    private _errors: any[] = []
    private _opts: IMoxyTaskSchedulerOptions = {
        defaultTime: 1,
        idleCooldown: 2000,
        stopAfterEmptyQueue: false,
        taskLimit: 100,
        tasksPerIdle: 2,
    }

    constructor(tasks?: IMoxyTask[], opts?: IMoxyTaskSchedulerOptions) {
        if (opts) { this._opts = Object.assign(this._opts, opts) }
        if (tasks) { tasks.forEach((task: IMoxyTask, index: number) =>
            index === tasks.length ? this.add(task, true) : this.add(task)) }
    }

    public start(): boolean {
        this._monitor()
        this._masterThread = setInterval(() => this._monitor(), this._opts.idleCooldown)
        return true
    }

    public stop(): boolean {
        this._workers.forEach((task: IMoxyTask) => {
            if (task.workerTask) { task.workerTask.terminate() }
        })
        clearInterval(this._masterThread)
        return true
    }

    public getTasks(): IMoxyTask[] {
        return this._tasks
    }

    public getWorkers(): IMoxyTask[] {
        return this._workers
    }

    public add(task: IMoxyTask, interrupt: boolean = false): boolean {
        if (!task.created) { task.created = new Date() }
        if (!task._id) { task._id = _f.uniqueId() }

        if (!task.priority) { task.priority = (this._opts.taskLimit || 100) - this._tasks.length }

        if (!task.retryLimit) { task.retryLimit = 0 }
        if (task.retryLimit && !task.retryInterval) { task.retryInterval = this._defaultRetryinterval }

        if (!task.schedule) { task.schedule = [] }
        if (task.schedule.length === 0) {
            const d = new Date()
            d.setMinutes(d.getMinutes() + (this._opts.defaultTime || 0))
            task.schedule.push(d)
        } else {
            this.sortSchedule(task)
        }
        this._tasks[this._tasks.length] = task
        if (interrupt) { this.sort() }
        return true
    }

    public remove(labelOrId: string, date?: Date): boolean {
        const task = this._tasks.find((task: IMoxyTask) => task._id === labelOrId || task.label === labelOrId)
        if (task) {
            if (date) {
                const d = task.schedule.findIndex((d: Date) => d === date)
                task.schedule = task.schedule.filter((date: any, index: number) => index !== d)
            } else {
                this._tasks = this._tasks.filter((t: IMoxyTask) => t._id !== task._id)
            }
            return true
        }
        return false
    }

    public rewind(): boolean {
        this._queuePointer = 0
        return true
    }

    public next(): boolean {
        this._queuePointer++
        if (this._queuePointer > this._tasks.length - 1) {
            this._queuePointer = 0
        }
        return true
    }
    public previous(): boolean {
        this._queuePointer--
        if (this._queuePointer < 0) {
            this._queuePointer = 0
        }
        return true
    }

    public peek(): IMoxyTask {
        return this._tasks[this._queuePointer + 1] || this._tasks[0]
    }

    public sort(): boolean {
        this._tasks.sort((a: IMoxyTask, b: IMoxyTask) => (a.priority || 0) > (b.priority || 0) ? -1 : 1)
        this.rewind()
        return true
    }

    public sortSchedule(task: IMoxyTask): boolean {
        task.schedule?.sort((a: Date, b: Date) => a.valueOf() < b.valueOf() ? -1 : 1)
        return true
    }

    public errorLogs(): any[] {
        return this._errors
    }

    private _monitor(): boolean {
        const d = new Date().valueOf()
        if (!this._tasks || this._tasks.length === 0) {
             if (this._opts.stopAfterEmptyQueue) { this.stop() }
             return false
        }

        for (let i = 0; i < (this._opts.tasksPerIdle || 2); i++) {
            const job = this._tasks[this._queuePointer]
            if (d > job.schedule[0].valueOf()) {
                const schedule = job.schedule.shift()
                if (job.cron) {
                    let time: number = schedule.valueOf()
                    time += job.cron.units === 'seconds'
                        ? (job.cron.interval * 1000)
                        : job.cron.units === 'minutes'
                        ? (job.cron.interval * 1000 * 60)
                        : job.cron.units === 'hours'
                        ? (job.cron.interval * 1000 * 60 * 60)
                        : job.cron.units === 'days'
                        ? (job.cron.interval * 1000 * 60 * 60 * 24)
                        : job.cron.units === 'weeks'
                        ? (job.cron.interval * 1000 * 60 * 60 * 24 * 7)
                        : (job.cron.interval * 1000) // default to seconds
                    const d: Date = new Date(time)
                    job.schedule.push(d) // Ensures cron runs indefinitely
                }
                this._execute(job)
                if (job && job.schedule.length === 0) {
                    this._tasks = this._tasks.filter((task: IMoxyTask) => task._id !== job._id)
                }
            } else {
                // Waiting
            }
            this.next()
            if (!this._tasks[this._queuePointer]) { break }
        }
        return true
    }

    private _execute(job: IMoxyTask): boolean {
        if (typeof job.task === 'function') {
            let retries: number = 0
            try {
                const ret = (job.task as () => boolean)()
                // Retry due to failure
                if (!ret && job.retryLimit) {
                    const retryTimer = setInterval(() => {
                        const ret = (job.task as () => boolean)()
                        retries++
                        if (ret || retries >= (job.retryLimit || 0)) {
                            clearInterval(retryTimer)
                        }
                    }, job.retryInterval)
                }
            } catch (e) {
                this._errors[this._errors.length] = {
                    error: e,
                    isWorker: false,
                    jobId: job._id,
                    label: job.label,
                    timestamp: new Date(),
                }
            }
        } else {
            // Worker thread
            this._workers[this._workers.length] = Object.assign({}, job)
            const instance = this._workers[this._workers.length - 1]
            try {
                instance.worker = new Worker(instance.task, instance.workerOpts)
                if (instance.workerInit) {
                    instance.workerInit(instance.worker) // run initializer
                }
            } catch (e) {
                this._errors[this._errors.length] = {
                    error: e,
                    isWorker: true,
                    jobId: instance._id,
                    label: instance.label,
                    timestamp: new Date(),
                }
            }
        }
        return true
    }
}
