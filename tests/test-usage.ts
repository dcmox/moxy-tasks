import { MoxyTaskScheduler } from '../moxy-tasks'

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
]

const scheduler = new MoxyTaskScheduler(jobs)
scheduler.start()
