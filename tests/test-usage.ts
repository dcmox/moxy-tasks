const taskScheduler = require('../moxy-tasks')

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
		cron: {
			interval: 1,
			unit: 'seconds',
		},
		label: 'Cron Task',
		priority: 1000,
		task: () => {
			console.log('I am a cron.')
			return true
		},
	},
]

const scheduler = new taskScheduler(jobs, {
	defaultTime: 0,
	idleCooldown: 500,
})
scheduler.start()
