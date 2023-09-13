// Library declaration
const {SerialPort} = require ('serialport'),
      sysinfo    = require ('systeminformation');

// Variables and constants
// lcd.path may differ in your system, adjust accordingly
// baudrate may be higher if you set it on the arduino sketch
const lcd = new SerialPort({
    path: '/dev/ttyUSB0',
    baudRate: 9600,
    autoOpen: false
});

// Insert here the functions that will draw the screens.
const LCDScreen = [
    screen_hostname,
    screen_diskinfo,
    screen_heartbeat,
    screen_uptime
];
// Initialize current screen counter at 0
let currentScreen = 0;

// We start the program by manually opening the serial connection.
// If we leave autoOpen as true, it will open and close the connection after every
// send command, and this makes the screen reset.
lcd.open(function (e)  {
    if (e) {
        // If we fail to open the connection, there's no point in keeping the app open.
        console.error ('Error opening port:', e.message);
        process.exit(1);
    }
    console.log(`Port at ${lcd.path} opened`);
});

// We set the port to read any input from serial
lcd.on('data', function (data) {
    const input = data.toString();
    // Sometimes we may get several A's, B's or a combination of both.
    // While this is not very elegant, it will filter these by simply ignoring them.
    switch (input) {
        case "A":
            currentScreen--;
            break;
        case "B":
            currentScreen++;
            break;
    }
    // check if we "flipped the counter"
    if (currentScreen < 0) currentScreen = LCDScreen.length-1;
    if (currentScreen > LCDScreen.length-1) currentScreen = 0;
})

// We set the LCD to refresh the screen once per second. This can be modified. I tried up to 4 FPS and there were
// issues, but in my particular case I don't see why I need a faster refresh.
lcd.on('open', function() {
    setInterval(writeToScreen, 1000);
});
// WriteToScreen just calls for the current screen to be drawn.
async function writeToScreen() {
    await LCDScreen[currentScreen]();
}
// Display Hostname and IP
async function screen_hostname() {
    // we get the hostname from systeminformation
    const {hostname} = await sysinfo.osInfo();
    const {ip4} = await sysinfo.networkInterfaces("default");
    sendCommand("CLEAR");
    sendCommand("HOME");
    lcd.write(prepareStringsForLCD(hostname));
    sendCommand("MOVETO", [0,1]);
    lcd.write(ip4);
}

// Hard drive info (will only show the first 2 drives)
async function screen_diskinfo() {
    // fsSize returns disk usage, but not human labels :(
    // blockdevices returns labels, but not disk usage :(
    // so we call both
    let fsData  = await sysinfo.fsSize();
    let fsBDs   = await sysinfo.blockDevices();
    const hardDriveInfo =
        // We prepare the content for consumption
        fsData
        // In my particular case I am only interested in the root drive, and the ones I mount myself (which are located in /mnt/, /media, or /run/media)
        .filter(
            d => (d.mount === "/" || d.mount.startsWith("/mnt") || d.mount.startsWith("/media") || d.mount.startsWith("/run/media"))
        )
        .map((drive) => {
            return {
                mount: drive.mount,
                use: Math.round(drive.use).toString().padStart(2,"0"),
                label: prepareStringsForLCD(fsBDs.find(bd => bd.mount === drive.mount).label)
            }
        });
    sendCommand("CLEAR");
    sendCommand("HOME");
    // If the drive has a label, we use the label. If not, we put the first 11 letters of the path;
    lcd.write(hardDriveInfo[0].label?hardDriveInfo[0].label:hardDriveInfo[0].mount.substring(0,11));
    sendCommand("MOVETO", [13,0]);
    lcd.write(`${hardDriveInfo[0].use}%`);
    sendCommand("MOVETO", [0,1]);
    lcd.write(hardDriveInfo[1].label?hardDriveInfo[1].label:hardDriveInfo[1].mount.substring(0,11));
    sendCommand("MOVETO", [13,1]);
    lcd.write(`${hardDriveInfo[1].use}%`);
}
// Network, CPU RAM
async function screen_heartbeat() {
    const UPARROW       = String.fromCharCode(0),
          DOWNARROW     = String.fromCharCode(1);
    const filter = {
        currentLoad: 'currentLoad',
        mem: 'total, active',
        networkStats: 'rx_sec, tx_sec, iface'
    }
    const data = await sysinfo.get(filter);
    const cpuUsage      = `${Math.round(data.currentLoad.currentLoad)}%`;
    const ramUsage      = `${Math.round((data.mem.active/data.mem.total)*100)}%`;
    const uploadSpeed   = `${UPARROW} ${humanizeBitsPerSecond(data.networkStats[0].tx_sec)}`;
    const downloadSpeed = `${DOWNARROW} ${humanizeBitsPerSecond(data.networkStats[0].rx_sec)}`;
    sendCommand("CLEAR");
    sendCommand("HOME");
    lcd.write(`CPU ${cpuUsage}`);
    sendCommand("MOVETO", [9,0]);
    lcd.write(`RAM ${ramUsage}`);
    sendCommand("MOVETO", [0,1]);
    lcd.write(uploadSpeed);
    sendCommand("MOVETO", [9,1]);
    lcd.write(downloadSpeed);
}
// Uptime
async function screen_uptime() {
    let {uptime}        = await sysinfo.time();
    uptime = Math.round(uptime);
    const uptimeDays    = Math.floor(uptime/86400);
    uptime = uptime - (uptimeDays * 86400);
    const uptimeHours   = Math.floor(uptime/3600);
    uptime = uptime - (uptimeHours * 3600);
    const uptimeMinutes = Math.floor(uptime/60);
    const uptimeSeconds = Math.floor(uptime - (uptimeMinutes*60));

    sendCommand("CLEAR");
    sendCommand("HOME");
    lcd.write("En linea desde:");
    sendCommand("MOVETO", [0,1]);
    lcd.write (`${uptimeDays.toString().padStart(3,"0")}Dias ${uptimeHours.toString().padStart(2," ")}:${uptimeMinutes.toString().padStart(2,"0")}:${uptimeSeconds.toString().padStart(2,"0")}`);
}

// The LCD supports a very limited character set. This filters it by removing or replacing all extraneous characters.
function prepareStringsForLCD (sourceText) {
    return sourceText
        .normalize("NFD")               // This removes all accents and diacritics, first by separating them into the letter and the accent (ñ becomes n~)
        .replace(/\p{Diacritic}/gu, "") // then by removing all diacritic marks
        .replace(/[^ !-\[\]-}]/g,"");   // This filters out any character not in the 32 to 125 ASCII range, which is the one the system supports, except for the \, which is replaced by the Yen symbol
}

// Systeminformation returns bits per second which is not very easy to read.
// This function transforms the data into Kbps and Mbps when reaching certain thresholds.
function humanizeBitsPerSecond (amount) {
    if (amount < 1024) {
        return `${Math.round(amount)}bs`
    }
    if (amount > 1024 && amount < 1048576) {
        return `${Math.round((amount/1024))}Kbs`
    }
    return `${Math.round((amount/1024/1024))}Mbs`
}

// This function allows us to send commands to the LCD. All commands except for write to ram are in.
function sendCommand(command, params) {
    const commands = {
        "CLEAR":      0x01,   // Clear the screen and screen bufferC
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
    let commandArray = new Uint8Array(2);
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

// Open errors will be emitted as an error event, but will not terminate the app
lcd.on('error', function(err) {
    console.error('Error: ', err.message)
})

// On closing the app we make sure we close the serial to avoid locking it.
const exitSignals = [
        'SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP',
        'SIGABRT','SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV',
        'SIGUSR2', 'SIGTERM'
    ];
exitSignals.forEach(function (sig) {
    process.on(sig, function () {
        lcd.close();
        console.log("\n",`Exiting because of ${sig}. Closing serial port.`);
        process.exit(0);
    });
});
