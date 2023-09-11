// quick serialport test
const {SerialPort} = require ('serialport'),
      ipFind       = require ('./app_modules/ipfinder'),
      sysinfo      = require ('systeminformation');

const lcd = new SerialPort({
    path: '/dev/ttyUSB0',
    baudRate: 9600,
    autoOpen: false
})

let   currentScreen = 0;
const maxScreen     = 3;
const UPARROW       = String.fromCharCode(0b01111111);
const DOWNARROW     = String.fromCharCode(0b01111110);

lcd.open(function (e)  {
    if (e) {
        return console.log ('Error opening port:', e.message);
    }
    console.log("Port opened");
});



lcd.on('open', function() {
    setInterval(writeToScreen, 1000);
});

async function writeToScreen() {
    switch (currentScreen) {
        case 0:
            // Display Hostname and IP
            const OS = await sysinfo.osInfo();
            const hostname = OS.hostname;
            const ip       = await ipFind();
            sendCommand("CLEAR");
            sendCommand("HOME");
            lcd.write(hostname);
            sendCommand("MOVETO", [0,1]);
            lcd.write(ip);
            break;
        case 1:
            // Hard drive info
            let fsData  = await sysinfo.fsSize();
            let fsBDs   = await sysinfo.blockDevices();
            fsData = fsData.map((drive, index) => {
                return {
                    mount: drive.mount,
                    use: drive.use,
                    label: fsBDs.find(bd => bd.mount === drive.mount).label
                }
            });
            fsData = fsData
                .filter(drive => (drive.mount === "/" || drive.mount.startsWith("/mnt") || drive.mount.startsWith("/media") || drive.mount.startsWith("/run/media")))
                .map(drive => {return {name: (drive.label)?drive.label.replace(/[^A-Za-z0-9]/g,""):drive.mount, value: `${Math.round(drive.use).toString().padStart(2, '0')}%`} });
            sendCommand("CLEAR");
            sendCommand("HOME");
            lcd.write(fsData[0].name);
            sendCommand("MOVETO", [13,0]);
            lcd.write(`${fsData[0].value}%`);
            sendCommand("MOVETO", [0,1]);
            lcd.write(fsData[1].name);
            sendCommand("MOVETO", [13,1]);
            lcd.write(`${fsData[1].value}%`);
            break;
        case 2:
            // Network, CPU RAM
            const filter = {
                currentLoad: 'currentLoad',
                mem: 'total, active',
                networkStats: 'rx_sec, tx_sec, iface'
            }
            const data = await sysinfo.get(filter);
            const CPU  = `${Math.round(data.currentLoad.currentLoad)}%`;
            const RAM  = `${Math.round((data.mem.active/data.mem.total)*100)}%`;
            const UP   = `${UPARROW} ${getHumanValue(data.networkStats[0].tx_sec)}`;
            const DOWN = `${DOWNARROW} ${getHumanValue(data.networkStats[0].rx_sec)}`;
            sendCommand("CLEAR");
            sendCommand("HOME");
            lcd.write(`CPU ${CPU}`);
            sendCommand("MOVETO", [9,0]);
            lcd.write(`RAM ${RAM}`);
            sendCommand("MOVETO", [0,1]);
            lcd.write(UP);
            sendCommand("MOVETO", [9,1]);
            lcd.write(DOWN);
            break;
        case 3:
            // Uptime
            let {current, uptime} = await sysinfo.time();
            uptime = Math.round(uptime);
            const UDAYS = Math.floor(uptime/86400);
            uptime = uptime - (UDAYS * 86400);
            const UHOUR = Math.floor(uptime/3600);
            uptime = uptime - (UHOUR * 3600);
            const UMINU = Math.floor(uptime/60);
            const USECO = Math.floor(uptime - (UMINU*60));
            sendCommand("CLEAR");
            sendCommand("HOME");
            lcd.write("En linea desde:");
            sendCommand("MOVETO", [0,1]);
            lcd.write (`${UDAYS.toString().padStart(3,"0")}D ${UHOUR.toString().padStart(2,"0")}:${UMINU.toString().padStart(2,"0")}:${USECO.toString().padStart(2,"0")}`);
            break;
    }

}

function getHumanValue(amount) {
    if (amount < 1024) {
        return `${Math.round(amount)}bs`
    }
    if (amount > 1024 && amount < 1048576) {
        return `${Math.round((amount/1024))}Kbs`
    }
    return `${Math.round((amount/1024/1024))}Mbs`
}


function sendCommand(command, params) {
    const commands = {
        "CLEAR":      0x01,   // Clear the screen and screen buffer
        "HOME":       0x02,   // Set the cursor position to 0,0
        "BLANK":      0x08,   // Blank the screen but withot clearing the buffer
        "RESTORE":    0x0C,   // Restore the screen to the status before blanking
        "CURSORLIN":  0x0E,   // Make the cursor a blinking line
        "CURSORBLO":  0x0F,   // Make the cursor a blinking block
        "CURSOROFF":  0x0C,   // Make the cursor invisible
        "EMSOFFDEC":  0x04,   // Entry mode, right to left, cursor scrolls
        "EMSONDEC":   0x05,   // Entry mode, right to left, text scrolls
        "EMSOFFINC":  0x06,   // Entry mode, left to right, cursor scrolls (default)
        "EMSONINC":   0x07,   // Entry mode, left to right, text scrolls
        "SCROLLEFT":  0x1E,   // All lines scroll left one character
        "SCROLRIGHT": 0x18,   // All lines scroll right one character
        "CURLEFT":    0x10,   // Move cursor 1 character to the left
        "CURRIGHT":   0x14,   // Move cursor 1 character to the right
        "MOVETO":     0x80   // Move the cursor. Requires params [x,y], so this command is only here for reference
    }
    if (!Object.keys(commands).some(c => command === c)) {
        console.log (`Invalid command: ${command}`);
        return false;
    }
    let commandLength = 2;
    let commandArray = new Uint8Array(commandLength);
    commandArray[0] = 0xFE;
    switch (command) {
        case "MOVETO":
            if (!Array.isArray(params)) {
                console.log (`Invalid param: ${params}. Was expecting [X,Y] array`);
                return false;
            }
            if (params.length !== 2) {
                console.log (`Invalid param: ${params}. Was expecting [X,Y] array`);
                return false;
            }
            if (params[0] > 39 || params[0] < 0 || params[1] > 1 || params[1] < 0) {
                console.log (`Invalid param: ${params}. Out of bound values`);
                return false;
            }
            commandArray[1] = 0x80 + (params[0] * 0x01) + (params[1] * 0x28);
            break;
        default:
            commandArray[1] = commands[command];
    }
    lcd.write(commandArray);
}

// Open errors will be emitted as an error event
lcd.on('error', function(err) {
    console.log('Error: ', err.message)
})

// Switches the port into "flowing mode"
lcd.on('data', function (data) {
    const input = data.toString();
    switch (input) {
        case "AB": // sometimes we get "AB" when we connect to the LCD. Don't know why, but we can make it ignore
            break;
        case "A":
            currentScreen--;
            break;
        case "B":
            currentScreen++;
            break;
    }
    if (currentScreen < 0) currentScreen = maxScreen;
    if (currentScreen > maxScreen) currentScreen = 0;
    //console.log('Data:', input, "CurrentScreen:", currentScreen);
})

process.on('SIGINT', function() {
    lcd.close();
    console.log("\n",'Exiting');
    process.exit(0);
})
