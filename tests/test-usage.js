"use strict";
exports.__esModule = true;
var moxy_tasks_1 = require("../moxy-tasks");
var d = new Date();
d.setMinutes(d.getMinutes() + 1);
var ds = new Date();
ds.setSeconds(d.getSeconds() + 10);
var jobs = [
    {
        label: 'Hi',
        task: function () {
            console.log('Hello World!');
            return true;
        }
    },
    {
        label: 'Blah',
        task: function () {
            console.log('Blahh');
            return true;
        }
    },
    {
        label: 'Hmmm',
        schedule: [new Date(), d, ds],
        task: function () {
            console.log('hmmmm');
            return true;
        }
    },
    {
        label: 'Worker',
        schedule: [new Date(), d, ds],
        task: './workerTest.js',
        workerInit: function (worker) {
            console.log('init');
        }
    },
    {
        cron: {
            interval: 1,
            unit: 'seconds'
        },
        label: 'Cron Task',
        priority: 1000,
        task: function () {
            console.log('I am a cron.');
            return true;
        }
    },
];
var scheduler = new moxy_tasks_1.MoxyTaskScheduler(jobs, { defaultTime: 0, idleCooldown: 500 });
scheduler.start();
