const k8s = require('@kubernetes/client-node');
const inquirer = require('inquirer');
const getPodUsage = require('./podUsage.js')



module.exports = async () => {
    
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
      getPodUsage(answers['list commands'], pods[answers['list commands']])
    });
};