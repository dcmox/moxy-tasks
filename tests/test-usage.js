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
];
var scheduler = new moxy_tasks_1.MoxyTaskScheduler(jobs);
scheduler.start();