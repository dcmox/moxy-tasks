# Moxy Task Scheduler
MoxyTaskScheduler is a task/job scheduler class. Define a set of tasks (Functions or Web Workers) with scheduled times, pass them into MoxyTaskScheduler, and let it do its job.

## Class Methods
* constructor(tasks: IMoxyTasks[]) - Specify the tasks you want to run on initialization
* start() - Starts the task scheduler
* stop() - Stops the task scheduler
* getTasks() - Retrieves the current list of tasks
* getWorkers() - Retrieves the list of workers spawned
* add(task: IMoxyTask, interrupt: boolean = false) - Adds a task to the task queue. Setting interrupt to true will cause the queue pointer to reset back to the highest priority item after sorting
* remove(labelOrId: string, date?: Date) - Removes a task from the task queue
* next() - Increase the queue pointer
* previous() - Decrease the queue pointer
* peek() - Retrieve the next task in the queue
* rewind() - Resets the queue pointer back to the first item in the queue
* sort() - Sort the tasks by priority. Done automatically on intialization. Sort causes a rewind() event to occur
* sortSchedule(task: IMoxyTask) - Sorts the scheduled times in a task, this is done automatically
* errorLogs() - Retrieve error logs associated with running tasks or web workers


## Interfaces
```
interface IMoxyTask {
    _id?: string
    label: string,
    created?: Date,
    priority?: number,
    retryLimit?: number,
    retryInterval?: number,
    schedule?: Date[],
    task: (() => boolean) | string, // Function or Worker path
    workerInit?: (worker: Worker) => any, // On worker creation, this function will execute if available
    workerTask?: any, // Used to store spawned worker internally.
    workerOpts?: any // Second parameter in new Worker(workerPath, [opts])
}

interface IMoxyTaskSchedulerOptions {
    defaultTime?: number = 1, // Default time in minutes task will run if no scheduled dates
    idleCooldown?: number = 2000, // Task scheduler will pause for X milliseconds between executing Y tasks
    stopAfterEmptyQueue?: boolean = false, // Task scheduler will complete after queue is empty if true, otherwise will keep listening until terminated manually
    taskLimit?: number = 100, // Not really a limit, sets the starting priority level to this number. Higher priority tasks run first
    tasksPerIdle?: number = 2, // Number of tasks inspected between idle time.
}

interface IMoxyCronOptions {
    unit?: string, //"seconds" | "minutes" | "hours" | "days" | "weeks"
    interval: number
}
```

## Usage
```typescript
const MoxyTaskScheduler = require('../moxy-tasks').MoxyTaskScheduler

const d = new Date()
d.setMinutes(d.getMinutes() + 1)

const ds = new Date()
ds.setSeconds(d.getSeconds() + 10)

const jobs = [
    {
        label: 'Hi',
        task: () => {
            console.log('Hello World!')
            return true
        },
    },
    {
        label: 'Blah',
        task: () => {
            console.log('Blahh')
            return true
        },
    },
    {
        label: 'Hmmm',
        schedule: [new Date(), d, ds],
        task: () => {
            console.log('hmmmm')
            return true
        },
    },
    {
        label: 'Worker',
        schedule: [new Date(), d, ds],
        task: './workerTest.js',
        workerInit(worker: Worker): void {
            console.log('init')
        },
    },
    {
        label: 'Cron',
        cron: {
            unit: 'seconds', // 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks'
            interval: 1,
        }
        task: './workerTest.js',
        workerInit(worker: Worker): void {
            console.log('init')
        },
    },
]

const scheduler = new MoxyTaskScheduler(jobs)
scheduler.start() // Start monitoring and processing tasks
```
