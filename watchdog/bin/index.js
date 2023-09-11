#!/usr/bin/env node
const logger = require('../src/logger.js');
const configuredLogger = logger('bin');
const arg = require('arg')
const getConfig = require('../src/config/config-mgr.js');
const start = require('../src/commands/start.js');
const express = require('express');
const app = express();
const fs = require('fs');
const k8s = require('@kubernetes/client-node');
const fetch = require('node-fetch');
const yaml = require('js-yaml');
const path = require("path");
const readline = require('readline');
const colors = require('colors');

//for DEBUG console.logs send string to 'configuredLogger.debug('strings', 'here')'
//show DEBUG logs with 'DEBUG=* watchdog --start'
//filter DEBUG logs by namespaceing the environment variable:
//  'DEBUG=commands:* watchdog --start' 

// Initialize Kubernetes API client
const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

//GET PODS
const getPods = () => {
    k8sApi.listPodForAllNamespaces().then((res) => {
      console.log('Pods:'.cyan);
      res.body.items.forEach((pod) => {
          // console.log(`${pod.metadata.namespace}/${pod.metadata.name}`);
          console.log(`   ${pod.metadata.name}`);
      });
      process.exit();
  })
  .catch((err) => {
      console.error('Error:', err);
  }); 
  };

//GET NODES
const getNodes = () => {
    k8sApi.listNode().then((res) => {
      console.log('Nodes:'.cyan);
      res.body.items.forEach((node) => {
          console.log(`   ${node.metadata.name}`);
      });
      process.exit();
  })
  .catch((err) => {
      console.error('Error:', err);
  });
  };

//GET CONTAINERS



const getContainers = () => {
    //queries for every pod, then pulls each container out of the pod and lists each individually...this will probably have to move to a sql database
    k8sApi.listPodForAllNamespaces().then((res) => {
      console.log('Containers:'.cyan);
      
      res.body.items.forEach((pod) => {
          // each of these pods can/will have multiple containers so we have to iterate through it again
          const containers = pod.spec.containers;
          containers.forEach((container) => {
              // console.log(`Namespace: ${pod.metadata.namespace}, Pod: ${pod.metadata.name}, Container: ${container.name}`);
              console.log(`   ${container.name}`);
          });
      });
      process.exit();
  })
  .catch((err) => {
      console.error('Error:', err);
  });
  };

let intervalID;

const localStorage = [];

const dbPull = () => {
return localStorage;
}

const dbAdd = (podname) => {
localStorage.push({name: podname})
}

let interval = 1000;

const podChecker = async () => {
intervalID = setInterval(async () => {
    //query for pod list
    const currentPods = await dbPull();
    k8sApi.listPodForAllNamespaces().then((res) => {
    const nameArray = []
    res.body.items.forEach((pod) => {
        //this is an array of objects with property 'name'
        nameArray.push(pod.metadata.name)
        
        let found = false;
        // console.log('length: ', currentPods.length)
        // console.log(currentPods)
        for (let i = 0; i < currentPods.length; i++) {
        if (currentPods[i].name === pod.metadata.name) {found = true};
        
        // console.log('currentPod in db: ', currentPods[i], 'checking against: ', pod.metadata.name)
        }
        
        // console.log('')
            //query from database
            //database returns an array of objects
            //if pod is not in database, add to database and log that it was created
            //if existing pod in database is not in query, delete it from database, and log that it was destroyed
        if (!found) {
        dbAdd(pod.metadata.name);
        console.log(`Added ${pod.metadata.name} to cluster`.green);
        }
        
    });
    return nameArray
}).then(async (res) => {
    //res is an array
    for (let i = 0; i < currentPods.length; i++) {
    if (!res.includes(currentPods[i].name)){
        console.log (`${currentPods[i].name} has crashed!`.red)
        localStorage.splice(i, 1)
        // await prisma.Pods.deleteMany({
        //   where: {
        //     name: currentPods[i].name
        //   }
        // })
    }
    }
    promptForCommand();
}

)
.catch((err) => {
    console.error('Error:', err);
}); 


    

}, interval)
};

const stopPodCheck = () => {
    clearInterval(intervalID);
};
  

//function to run to quit watching pods:

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

const promptForCommand = () => {
    rl.question('> ', (command) => {
        switch (command.length > 0) {
        case true:
            stopPodCheck();
            process.exit();
            console.log('Watchdog is taking a break from pod watching');
            return;
        default:
            console.log('Unknown command. Type "help" for available commands.');
        }

        // promptForCommand(); // Continue prompting
    });
};
  
  

const dog = `░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░▓▓▓▓▓▓▒▒░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒▒▒▓▓▓▓▓▒░░░░░░░░░░░░░░░
░░░░░░░░░░░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░░░░░░░░░░░░░
░░░░░░░░░░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒░░░░░░░░░░░░░░░░░░▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░
░░░░░░░░░░▓▓▓▓▓▓░░░░▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒░░░░▓▓▓▓▓▒░░░░░░░░░░░░
░░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒░░░░░░░░░░░▒▓▓▓▓▓░░░░░░░░░░░░
░░░░░░░░░▒▓▓▓▓▓░░░░░░░░░░░░░░░▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓▓▓▓▓▓▒░░░░░░░░░░░░░░░▓▓▓▓▓░░░░░░░░░░░░
░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░░░░▒▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▒░░░░░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░
░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░░▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓░░░░░░░░░░░░▒▓▓▓▓▓░░░░░░░░░░░
░░░░░░░░▒▓▓▓▓▓░░░░░░░░░░░▓▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▒░░░░░░░░░░▒▓▓▓▓▓▒░░░░░░░░░░
░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓░░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░
░░░░░░░░▓▓▓▓▓░░░░░░░░░▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▒░░░░░░░░▒▓▓▓▓▓░░░░░░░░░░
░░░░░░░▒▓▓▓▓▓░░░░░░░▒▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓░░░░░░░░▓▓▓▓▓▒░░░░░░░░░
░░░░░░░▓▓▓▓▓▒░░░░░░▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▒░░░░░░▓▓▓▓▓▓░░░░░░░░░
░░░░░░▒▓▓▓▓▓░░░░░▒▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓░░░░░▒▓▓▓▓▓░░░░░░░░░
░░░░░░▓▓▓▓▓▓░░░░▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▒░░░░▓▓▓▓▓▒░░░░░░░░
░░░░░░▓▓▓▓▓▒░░▒▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▒░░▒▓▓▓▓▓░░░░░░░░
░░░░░▒▓▓▓▓▓░░▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▒░░▓▓▓▓▓░░░░░░░░
░░░░░▓▓▓▓▓▓▒▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓▒▓▓▓▓▓▒░░░░░░░
░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░▓▓▓▓▒░░░░░░░░░░░░░░░░░░░░▓▓▓▓▒░░░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▒░░░░░░░
░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░▒▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓▒░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░
░░░░░░░░▒▓▓▓▒▓▓▓▓▓▓░░░░░░░░▒▓▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▓▒░░░░░░░░▓▓▓▓▓▒▒▓▓▓▒░░░░░░░░░░
░░░░░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░▒▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▒░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░░░░░
░░░░░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░░░░░
░░░░░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░░░░░
░░░░░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░░░░░
░░░░░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░░░░░░░░▒▓▓▓▒░░░░░░▒▓▓▓▒░░░░░░░░░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░░░░░
░░░░░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▒░░▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░░░░░
░░░░░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░░░░░
░░░░░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░▓▓▓▓▓░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░▒▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░▒▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░▓▓▓▓▓▒░░░░░░░░░░░░░░░░▒▒▓▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
`

// console.log(dog.cyan);

// console.log('Welcome to the Watchdog CLI.'.cyan);

try {
  const args = arg({
    '--start': Boolean,
    '--pods': Boolean,
    '--nodes': Boolean,
    '--containers': Boolean,
    '--watch': Boolean
  });

  configuredLogger.debug('Received args', args);

  if (args['--start']) {
    const config = getConfig();
    start(config);
  } if (args['--pods']) {
    getPods();
  } if (args['--nodes']) {
    getNodes();
  } if (args['--containers']) {
    getContainers();
  } if (args['--watch']) {
    podChecker();
  }
} catch (e) {
    configuredLogger.warning(e.message);
  console.log();
  usage();
}

//THIS RUNS WHEN UNEXPECTED FLAGS ARE GIVEN
function usage() {
    console.log(`'watchdog [command]'
    '--start'\t\tStarts the app
    '--pods'\t\tDisplays running pods
    '--nodes'\t\tDisplays running nodes
    '--containers'\tDisplays running containers`);
    }
