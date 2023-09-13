# The computer-side app
This app is written in node.js and requires the serialport and systeminformation libraries. The app is written for Linux in mind but there should be no reason it cannot run in Windows by changing the port reference, and modifying the screen functions that handle OS-specific situations, like the hard disk stats. Systeminformation tries to be as OS-agnostic as possible so things like CPU, Memory, Network Interfaces... should work out of the box.

## The app structure
The app will open the serial port defined in the lcd object and will call a _screen function_ once per second. It will also listen for pushbutton events that will change which screen is active.

## The screen functions
The screen functions are self contained: They retrieve the data from systeminformation and update the LCD screen.
There are currently four:
* screen_hostname: displays current local IP and hostname
* screen_diskinfo: retrieves hard drive usage and label or path and displays the first two.
* screen_heartbeat: displays CPU, RAM, and Network usage
* screen_uptime: displays system uptime

