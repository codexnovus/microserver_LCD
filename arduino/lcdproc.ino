/*

 The circuit:
 * LCD RS pin to digital pin 12
 * LCD Enable pin to digital pin 11
 * LCD D4 pin to digital pin 5
 * LCD D5 pin to digital pin 4
 * LCD D6 pin to digital pin 3
 * LCD D7 pin to digital pin 2
 * LCD R/W pin to ground
 * 10K resistor:
 * ends to +5V and ground
 * wiper to LCD VO pin (pin 3)

Arduino code based on liquid crystal library + lcdproc source code
(see https://github.com/lcdproc/lcdproc/blob/master/server/drivers/hd44780-serial.h, HD44780_CT_LCDSERIALIZER)

 http://www.arduino.cc/en/Tutorial/LiquidCrystalSerialDisplay

*/


// include the library code:
#include <LiquidCrystal.h>

// UART config
const int baud = 9600;
const int escapeByte = 0xFE;

// display pinning & dimensions
const int rs = 12, en = 11, d4 = 3, d5 = 4, d6 = 5, d7 = 6;
const int rows = 2;
const int colums = 16;
const byte uparrow[8] = {
  B00000,
  B00100,
  B01110,
  B10101,
  B00100,
  B00100,
  B00000,
  B00000
};

const byte downarrow[8] = {
  B00000,
  B00100,
  B00100,
  B10101,
  B01110,
  B00100,
  B00000,
  B00000
};

// initialize the library by associating any needed LCD interface pin
// with the arduino pin number it is connected to
LiquidCrystal lcd(rs, en, d4, d5, d6, d7);

void setup() {
  // set up the LCD's number of columns and rows:
  lcd.begin(colums, rows);
  
  // initialize the serial communications:
  Serial.begin(baud);

  // give hint on how to send data to display
  lcd.createChar(0, uparrow);
  lcd.createChar(1, downarrow);
  lcd.clear();
  lcd.print("Inicializando");
  lcd.setCursor(0,1);
  lcd.print("pantalla");
  pinMode(A1, INPUT_PULLUP);
  pinMode(A2, INPUT_PULLUP);
  
}

// for instruction escape logic
uint8_t c = 0xFF;
bool instructionEscape = false;

// for timeout display logic
uint32_t timeoutCounter = 1;
uint32_t lastTimeReception = 0;

// for button pressing logic
bool aIsPressed = false;
bool bIsPressed = false;
 
void loop()
{
    // logic to show message in case of no update
    timeoutCounter+=1;
    if((timeoutCounter>2000000) && (timeoutCounter%1000)==0)
    {
        // calculate time
        uint32_t seconds = ((millis()/1000) - lastTimeReception); // overflow might happen!
        int minutes = seconds/60;
        int hours = minutes/60;
        seconds = seconds%60;
        minutes = minutes%60;
        char timestring[20];
        snprintf(timestring,20,"%04d:%02d:%02d",hours,minutes,seconds);

        lcd.clear();
        lcd.print("Desconectado");
        lcd.setCursor(0,1);        
        lcd.print(timestring);
    }

    while (Serial.available() > 0)
    {
        timeoutCounter=0;
        lastTimeReception = millis()/1000;
        // display each character to the LCD
        c = Serial.read();

        // last char was escape character
        if(instructionEscape == true)
        {
            instructionEscape = false;
            lcd.command(c);
        }
        else
        {
            if((c == escapeByte) ) // command escape character
            {
                instructionEscape = true;
            }
            else
            {
                lcd.write(c);  
            }  
        }
    }
   
   int buttonA = digitalRead(A1);
   int buttonB = digitalRead(A2);
   if (buttonA == HIGH && aIsPressed == false) {
    aIsPressed = true;
    Serial.write("A");
   }
   if (buttonA == LOW && aIsPressed == true) {
    aIsPressed = false;
   }
    if (buttonB == HIGH && bIsPressed == false) {
    bIsPressed = true;
    Serial.write("B");
   }
   if (buttonB == LOW && bIsPressed == true) {
    bIsPressed = false;
   }
}
