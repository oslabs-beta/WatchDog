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
const chalk = require('chalk');
const inquirer = require('inquirer');
const log = console.log;
const getNodeUsage = require('./nodeUsage.js') 
const givePods = require('./podDropdown.js')
const getPodUsage = require('./podUsage.js')

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

let watchPods = true;
let watchCPUFlag = true;
//each pod to be watched, stick the pod name and treshold into an object with the properties 'name' and 'threshold'


const podChecker = async () => {
intervalID = setInterval(async () => {
    const currentPods = dbPull();
    async function managePods() {
        try {
        // Fetch all the pods
        const res = await k8sApi.listPodForAllNamespaces();
        
        const nameArray = [];
        
        res.body.items.forEach((pod) => {
            nameArray.push(pod.metadata.name);
            
            let found = false;
            for (let i = 0; i < currentPods.length; i++) {
            if (currentPods[i].name === pod.metadata.name) {
                found = true;
            }
            }
            
            if (!found) {
            dbAdd(pod.metadata.name);
            if (counter > 0) {
                console.log(`Added ${pod.metadata.name} to cluster`.green);
            }
            }
        });
        
        counter++;
        
        // Checking for crashed pods
        for (let i = 0; i < currentPods.length; i++) {
            if (!nameArray.includes(currentPods[i].name)) {
            console.log(`${currentPods[i].name} has crashed!`.red);
            localStorage.splice(i, 1);
            }
        }
        
        
        } catch (err) {
        console.error('Error:', err);
        }
    }

    const watchCPU = () => {
        const kc = new k8s.KubeConfig();
        kc.loadFromDefault();
        const k8sApi = kc.makeApiClient(k8s.CustomObjectsApi);
        const group = 'metrics.k8s.io';
        const version = 'v1beta1';
        const plural = 'pods';
    
        async function getPodMetrics() {
        try {
            // console.log('fs.readFile(path.resolve(__dirname, "../data/characters.json"), "UTF-8")', fs.readFile(path.resolve(__dirname, "./podCPU.json"), "UTF-8"))
            const data = fs.readFile(path.resolve(__dirname, "./podCPU.json"), "UTF-8", (err, data) => {
                if (err) {
                  console.error('Error reading the file:', err);
                } else {
                  const parsedData = JSON.parse(data);
                  parsedData.forEach(async (pod) => {
                    const { name, namespace, treshold, max } = JSON.parse(pod);
                
                    const res = await k8sApi.getNamespacedCustomObject(group, version, namespace, plural, name);
                    
                    if ((Number(res.body.containers[0].usage.cpu.slice(0, -1))/ max) * 100 > treshold) {
                        console.log(`${name} has exceeded the treshold of ${treshold}%`)
                    }


                  })
                }
              });
      
        } catch (err) {
            console.error('Error fetching metrics:', err);
            process.exit();
        }}
       getPodMetrics();
    };
    
    // Call the function
    if (watchPods) {
        managePods();
    };
    if (watchCPUFlag) {
        watchCPU();
    };

    promptForCommand();

    }, interval)
};

const stopPodCheck = () => {
    clearInterval(intervalID);
};

const podCPUWatchDropDown = async (treshold) => {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api); 

    const pods = await k8sApi.listPodForAllNamespaces().then((res) => {
      
      const podArray = {};
      res.body.items.forEach((pod) => {
         podArray[pod.metadata.name] = pod.metadata.namespace
        });
    
      return podArray
  }).then((pods) => {
        return pods})
  .catch((err) => {
      console.error('Error:', err);
  }); 

  inquirer
  .prompt([
    {
      type: 'rawlist',
      name: 'list commands',
      message: 'Select a pod:',
      choices: [...Object.keys(pods), new inquirer.Separator()]
    },
  ])
  .then(async (answers) => {
    const res = await k8sApi.readNamespacedPod(answers['list commands'], pods[answers['list commands']]);
    const pod = res.body;
    const container = pod.spec.containers[0];
    const jsonPod = JSON.stringify({
        name: answers['list commands'],
        namespace: pods[answers['list commands']],
        treshold: treshold,
        max: Number(container.resources.requests.cpu.slice(0, -1)) * 1000000})
    // podsCPUWatch.push({name: answers['list commands'], namespace: pods[answers['list commands']], treshold: treshold, max: Number(container.resources.requests.cpu.slice(0, -1)) * 1000000});
    async function appendToFile(newObject) {
        const filePath = path.resolve(__dirname, "./podCPU.json");
        
        // Read the existing file
        const data = fs.readFile(path.resolve(__dirname, "./podCPU.json"), "UTF-8", (err, data) => {
            if (err) {
              console.error('Error reading the file:', err);
            } else {
              const parsedData = JSON.parse(data);
            
              parsedData.push(newObject);
             
            //   fs.writeFile(path.resolve(__dirname, "./podCPU.json"), JSON.stringify(parsedData, null, 2))
            fs.writeFile(filePath, JSON.stringify(parsedData), (err) => {
                if (err) {
                  console.error('Error writing to file:', err);
                } else {
                  console.log('Successfully wrote to file');
                }
              });
            }
          });
  
    
        // Parse the JSON
        // const json = JSON.parse(data);
        //   console.log('data: ', data)
        // Add the new data
        // data.push(newObject);
    
        // Serialize it back to JSON and write to the file
        // fs.writeFile(filePath, JSON.stringify(data, null, 2));
    }
    
    appendToFile(jsonPod);
    
    
    // fs.appendFile(
    //     path.resolve(__dirname, "./podCPU.json"),
    //     jsonPod,
    //     (err) => {
    //         if (err) {
    //           console.error('Error writing to file:', err);
    //         } else {
    //           console.log('Successfully wrote to file');
    //         }
    //       }
    //   )
//     fs.appendFile('./podCPU.json', jsonPod, (err) => {
//   if (err) {
//     console.error('Error writing to file:', err);
//   } else {
//     console.log('Successfully wrote to file');
//   }
// });
  });
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
    return new Promise((resolve) => {
        // console.log('obj: ', obj)
        setTimeout(() => {
          api.create(obj);
          resolve();
        }, 1000);
      });
}

async function installMetricsServer() {
  try {
    const manifest = yaml.loadAll(fs.readFileSync(path.resolve(__dirname, './../high-availability-1.21+.yaml'), 'utf8'));
    for (const obj of manifest) {
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
    process.exit();
  } else {
    console.log("Metrics Server is not installed. Installing now...");
    await installMetricsServer();
  }
};


const metricsAPI = 'apis/metrics.k8s.io/v1beta1';

async function getPodMetric(namespace = 'kube-system') {
  try {
    const customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);
    const res = await k8sApi.listNamespacedPod(namespace);
    
    const podNames = res.body.items.map(pod => pod.metadata.name);
    for (const podName of podNames) {
      const { body } = await customObjectsApi.getNamespacedCustomObject(
        'metrics.k8s.io',
        'v1beta1',
        namespace,
        'pods',
        podName
      );
      
      console.log(`Metrics for pod ${podName}: `, body.containers[0].usage);
    }
    process.exit();
  } catch (err) {
    console.error('Error fetching metrics: ', err);
    process.exit();
  }
}


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

const promptForCommand = () => {
    rl.question('> ', (command) => {
        switch (command.length >= 0) {
        case true:
            stopPodCheck();
            console.log('Watchdog is taking a break from pod watching');
            fs.writeFileSync(path.resolve(__dirname, "./podCPU.json"), JSON.stringify([]), (err) => {
                if (err) {
                  console.error('Error clearing file:', err);
                } 
              });
            process.exit();
            return;
        default:
            console.log('Unknown command. Type "help" for available commands.');
        }
    });
};

async function getPodResourcePercents(podName, namespace) {
  try {
    const res = await k8sApi.readNamespacedPod(podName, namespace);
    const pod = res.body;

    const currentUsage = async (names, namespaces) => {
        const kc = new k8s.KubeConfig();
        kc.loadFromDefault();
        const k8sApi = kc.makeApiClient(k8s.CustomObjectsApi);
        const group = 'metrics.k8s.io';
        const version = 'v1beta1';
        const namespace = namespaces; // Replace with your namespace
        const plural = 'pods';
        const name = names; // Replace with your pod name
    
        async function getPodMetrics() {
        try {
            const res = await k8sApi.getNamespacedCustomObject(group, version, namespace, plural, name);
            // console.log(names, 'metrics:', res.body.containers[0].usage);
            return {cpu: res.body.containers[0].usage.cpu, memory: res.body.containers[0].usage.memory}
            // process.exit();
        } catch (err) {
            console.error('Error fetching metrics:', err);
            process.exit();
        }}
       return getPodMetrics();
      }; 
      const { cpu, memory } = await currentUsage(podName, namespace)   

    const container = pod.spec.containers[0]
    const totalMemory = container.resources.requests.memory || 10000
    console.log(`Pod: ${container.name}`);
    console.log(`Current CPU Usage: ${((Number(cpu.slice(0, -1)) / (Number(container.resources.requests.cpu.slice(0, -1)) * 1000000)) * 100).toFixed(2)}%`);
    console.log(`Current Memory Usage: ${(Number(memory.slice(0, -2)) / totalMemory).toFixed(2)}%`);
    console.log('---');
    
  } catch (err) {
    console.error('Error fetching pod info:', err);
  }
}

// POD PERCENT WITH DROP DOWN
const podPercent = async () => {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api); 

    const pods = await k8sApi.listPodForAllNamespaces().then((res) => {
      
      const podArray = {};
      res.body.items.forEach((pod) => {
         podArray[pod.metadata.name] = pod.metadata.namespace
        });
    
      return podArray
  }).then((pods) => {
        return pods})
  .catch((err) => {
      console.error('Error:', err);
  }); 

  inquirer
  .prompt([
    {
      type: 'rawlist',
      name: 'list commands',
      message: 'Select a pod:',
      choices: [...Object.keys(pods), new inquirer.Separator()]
    },
  ])
  .then((answers) => {
    getPodResourcePercents(answers['list commands'], pods[answers['list commands']])
  });

};
  

// GIVE HELP TO USER
const giveHelp = () => {
  inquirer
    .prompt([
      {
        type: 'rawlist',
        name: 'list commands',
        message: 'What do you want to do?',
        choices: [
          'Display running pods',
          'Display running nodes',
          'Display running containers',
          'Display current node CPU and memory usage',
          'Display valid commands',
          new inquirer.Separator(),
          'Other potential options...',
        ],
      },
    ])
    .then((answers) => {
      for (const key in answers) {
        if (answers[key] === 'Display running pods') {
          getPods();
        }
        if (answers[key] === 'Display running nodes') {
          getNodes();
        }
        if (answers[key] === 'Display running containers') {
          getContainers();
        }
        if (answers[key] === 'Display current node CPU and memory usage') {
          getNodeUsage();
        }
        if (answers[key] === 'Display valid commands') {
            printCommands();
        }
      }
    });
};

//list of valid commands
const validCommands = [
	{ option: '--start', description: 'Starts the app' },
	{ option: '--wizard', description: 'Displays interactive CL prompt!' },
	{ option: '--pods', description: 'Displays running pods' },
	{ option: '--nodes', description: 'Displays running nodes' },
	{ option: '--containers', description: 'Displays running containers' },
	{ option: '--watch', description: 'Watch pods' },
	{ option: '--metrics', description: 'Get pod metrics' },
	{ option: '--help', description: 'Show available commands' },
	{
		option: '--nodeusage',
		description: 'Display current node CPU and memory usage',
	},
	{ option: '--podusage', description: 'Display pod usage' },
];

function printCommands() {
	console.log(chalk.cyan('List of Valid Commands: watchdog '));
	validCommands.forEach((command) => {
		console.log(chalk.cyan(`${command.option}:`), command.description);
	});
}
//added --wizard command like oliver suggested(now the new interactive prompt)
//--help just shows the list of commands
try {
  const args = arg({
    '--start': Boolean,
    '--pods': Boolean,
    '--nodes': Boolean,
    '--containers': Boolean,
    '--watch': Boolean,
    '--metrics': Boolean,
    '--help': Boolean,
    '--wizard': Boolean,
    '--nodeusage': Boolean,
    '--podusage': Boolean,
    '--podpercent': Boolean,
    '--cpuwatch': Number
  });

	configuredLogger.debug('Received args', args);

    if (args['--start']) {
		// const config = getConfig();
		// start(config);
		console.log('Checking for Metrics Server...');
		metricServerInstaller();
	} else if (args['--pods']) {
		getPods();
	} else if (args['--nodes']) {
		getNodes();
	} else if (args['--containers']) {
		getContainers();
	} else if (args['--watch']) {
		podChecker();
		setTimeout(() => console.log('Press Enter to stop watching.'), 1500);
	} else if (args['--metrics']) {
		getPodMetric();
	} else if (args['--wizard']) {
		giveHelp();
	} else if (args['--nodeusage']) {
		getNodeUsage();
	} else if (args['--podusage']) {
		givePods();
		// getPodUsage('kube-scheduler-minikube', 'kube-system');
	} else if (args['--podpercent']) {
        podPercent();
    } else if (args['--help']) {
		printCommands();
		process.exit();
	} else if (args['--cpuwatch']) {
        podCPUWatchDropDown(args['--cpuwatch'])
		// printCommands();
		// process.exit();
	} else {
		log('Invalid command. Type in "watchdog --help" for a list of valid commands.');
		process.exit();
	}
} catch (e) {
	configuredLogger.warning('Please make sure command is written properly.');
	log();
	process.exit();
}