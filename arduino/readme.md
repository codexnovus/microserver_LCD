# Arduino Code

This part of the project borrows heavily from [arduino-lcdproc](https://github.com/TimeTravel-0/arduino-lcdproc) plus some tutorials.

The sketch initializes the screen, and has a timeout function when is not receiving data.

It also reads the status of the buttons and sends A or B whenever one is pressed.

Is not really complex, but doesn't need to be.

Using this script also has the nice extra bonus of being compatible with LCDProc serializer mode, though the buttons won't be supported.

# The circuit

The circuit is fairly simple, the only complication is finding the proper resistance wiper for your project. Mine could have used a 30K. At 20K it simply goes from nothing until you reach like 90% and then it kicks right in into the visible territory.

![The schematic](./circuit_schematics.png)

Originally This project embedded the circuit directly into the screen but I had issues routing the USB cable so in the end I separated everything. Optionally you can also solder a small ceramic cap to the button if you get a lot of bouncing noise when pushing it.
