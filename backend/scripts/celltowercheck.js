const Location = require("../Dtos/Location.js");
var num = 0;
async function findLocationWithTwoIndexes(){
    //Node.js has a built-in module called path.
    const path = require("path");

    //require("dotenv").config({})
    //This loads the variables stored in your .env file into Node's environment.
    // Your .env probably contains something like:
    // MONGODB_URI=mongodb+srv://...
    // GEOAPIFY_API_KEY=...
    // Before running dotenv, Node doesn't automatically know about those variables.
    // After running it, you can access them through:
    // process.env.GEOAPIFY_API_KEY
    require("dotenv").config({    
        //_dirname is D:\D\railpull-main\backend\scripts    
        //it changes to D:\D\railpull-main\backend\.env after the following piece of code
        path: path.join(__dirname, "../.env")
    });

    //This imports your Mongoose model.
    const Location = require("../Dtos/Location.js");
    //This imports your database connection function.
    //the database.js is responsible for actually establishing the connection between Node.js and MongoDB.
    const connectDatabase = require("../config/database");
    await connectDatabase();;    
    let num = 0;
    location.forEach(location => {
        let cellTowerArray = location.cellTowers;
        for (let cellTower of cellTowerArray){
            console.log(`${num}: ${cellTower.cellId}`);          
        }num++;
    });
    console.log(num);
}

findLocationWithTwoIndexes();
