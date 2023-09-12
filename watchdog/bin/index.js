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
const getPods = require('./getPods.js');
const getNodes = require('./getNodes.js');
const getContainers = require('./getContainers.js');

//for DEBUG console.logs send string to 'configuredLogger.debug('strings', 'here')'
//show DEBUG logs with 'DEBUG=* watchdog --start'
//filter DEBUG logs by namespaceing the environment variable:
//  'DEBUG=commands:* watchdog --start' 

// Initialize Kubernetes API client
const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);


let intervalID;

const localStorage = [];

const dbPull = () => {
return localStorage;
}

const dbAdd = (podname) => {
localStorage.push({name: podname})
}

let interval = 1000;

let counter = 0;

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
            if (counter > 0) {
                console.log(`Added ${pod.metadata.name} to cluster`.green);
            }
        }
        
        
        
    });
    counter++;
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
  

//METRICS SERVER

async function checkMetricsServer() {
  const api = kc.makeApiClient(k8s.ApisApi);
  try {
    const result = await api.getAPIVersions();
    const metricsAPI = result.body.groups.find(group => group.name === 'metrics.k8s.io');
    return Boolean(metricsAPI);
  } catch (error) {
    console.error("Failed to retrieve API groups:", error);
    return false;
  }
}

const api = kc.makeApiClient(k8s.KubernetesObjectApi);

async function applyYaml(obj) {
//   obj.metadata.namespace = obj.metadata.namespace || 'kube-system';
//   console.log('obj: ', obj)
//     await api.create(obj);
    return new Promise((resolve) => {
        // console.log('obj: ', obj)
        setTimeout(() => {
          api.create(obj);
          resolve();
        }, 1000);
      });
//   try {
//     await api.read(obj);
//     await api.replace(obj);
//   } catch (err) {
//     if (err.response && err.response.statusCode === 404) {
//         console.log('obj', obj)
//       await api.create(obj);
//     } else {
//       throw err;
//     }
//   }
}

async function installMetricsServer() {
  try {
    const manifest = yaml.loadAll(fs.readFileSync(path.resolve(__dirname, './../high-availability-1.21+.yaml'), 'utf8'));
    // console.log('manifest: ', manifest)
    for (const obj of manifest) {
    //    setTimeout(() => {applyYaml(obj)}, 1000);
        await applyYaml(obj)
    }
    console.log('Metrics Server installed successfully.');
    setTimeout(() => process.exit(), 1000);

  } catch (err) {
    console.error('Failed to install Metrics Server:', err);
  }
}

const metricServerInstaller = async () => {
  const isMetricsServerInstalled = await checkMetricsServer();
  if (isMetricsServerInstalled) {
    console.log("Metrics Server already installed.");
    // process.exit();
  } else {
    console.log("Metrics Server is not installed. Installing now...");
    await installMetricsServer();
  }
};




// async function checkMetricsServer() {
//     const api = kc.makeApiClient(k8s.ApisApi);
//     try {
//       const result = await api.getAPIVersions();
//     //   console.log('result: ', result.body.groups)
//       const metricsAPI = result.body.groups.find(group => group.name === 'metrics.k8s.io');
//     //   console.log('metricsAPI: ', metricsAPI)
//       return Boolean(metricsAPI);
//     } catch (error) {
//       console.error("Failed to retrieve API groups:", error);
//       return false;
//     }
//   }

// const api = kc.makeApiClient(k8s.KubernetesObjectApi);
// async function applyYaml(obj) {
//     obj.metadata.namespace = obj.metadata.namespace || 'default';
//     console.log('doing ish')
//         // console.log('length: ', objArray.length)
//         // await api.create(obj)
//       try {
//         console.log('Applying object:');
//         await api.create(obj);
//       } catch (err) {
//         if (err.response && err.response.statusCode === 404) {
//         //   await api.create(obj);
//           console.log('Successfully created object');
//         } else {
//           console.log('Unknown error:', err);
//           // If you wish, you can break the loop here or continue to the next iteration
//         }
//       }

    
//   }
  
//   async function installMetricsServer() {
//     try {
//     //   const response = await fetch('https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml');
//     //   const text = await response.text();
//     //   const manifest = yaml.loadAll(text);
   
//     const manifest = yaml.loadAll(fs.readFileSync(path.resolve(__dirname, './../high-availability-1.21+.yaml'), 'utf8'));
//     // console.log('manifest: ', manifest)
//     // for (const obj of manifest) {
//     //     await applyYaml(obj);
//     //   }
//     manifest.forEach((manifestObj) => {
//         applyYaml(manifestObj)
//     })
//     console.log('Metrics Server installed successfully.');
//     } catch (err) {
//       console.error('Failed to install Metrics Server:', err);
//     }
//   }
  
//   const metricServerInstaller = async () => {
//     const isMetricsServerInstalled = await checkMetricsServer();
//     if (isMetricsServerInstalled) {
//       console.log("Metrics Server already installed.");
//       //await installMetricsServer();
//     } else {
//       console.log("Metrics Server is not installed. Installing now...");
//       await installMetricsServer();
//     }
//   };
  
//   metricServerInstaller();


//function to run to quit watching pods:

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

const promptForCommand = () => {
    rl.question('> ', (command) => {
        switch (command.length >= 0) {
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
    // const config = getConfig();
    // start(config);
    console.log('Checking for Metrics Server...')
    metricServerInstaller();
  } else if (args['--pods']) {
    getPods();
  } else if (args['--nodes']) {
    getNodes();
  } else if (args['--containers']) {
    getContainers();
  } else if (args['--watch']) {
    podChecker();
    setTimeout(()=>console.log('Press Enter to stop watching.'), 1500)
  } else {
    console.log('COMMAND NOT FOUND')
    process.exit();
  }
} catch (e) {
    configuredLogger.warning(e.message);
  console.log();
  process.exit();
}

//THIS RUNS WHEN UNEXPECTED FLAGS ARE GIVEN
function usage() {
    console.log(`'watchdog [command]'
    '--start'\t\tStarts the app
    '--pods'\t\tDisplays running pods
    '--nodes'\t\tDisplays running nodes
    '--containers'\tDisplays running containers`);
    }
