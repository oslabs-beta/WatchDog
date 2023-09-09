#!/bin/bash

# this script should work as executable
# Check for the app directories
if [ ! -d "watchdog" ] || [ ! -d "watchdogApp" ]; then
  echo "Missing app1 or app2 directory. Please run this script from the root directory of the project."
  exit 1
fi

# Navigate into the first app directory and link it
cd watchdog
npm link
npm install
cd ..

# Navigate into the second app directory and link the first app
cd watchdogApp
npm link watchdog
npm install
cd ..

echo "Successfully linked!"
