import WebSocket from "ws";
import dotenv from "dotenv";
import {WebSocketRequest} from "./types";
import {config} from "./config"; 
import {fetchTransactionDetails, createSwapTransaction,getRugCheckConfirmed} from "./transactions";


dotenv.config();

function sendRequest(ws:WebSocket):void{
    const request: WebSocketRequest = {
        jsonrpc:"2.0",
        id: 1,
        method:"logsSubscribe",
        params:[
            {
                mentions: [ config.liquididity_pool.radiyum_program_id]
            },
            {
                commitment:"processed",
            },
        ],
    },
    ws.send(JSON.stringify(request));
}
  



async function WebSocketHandler():Promise<void>{
let ws: WebSocket |null = new WebSocket(ProcessingInstruction.env.HELIUS_WSS_URI || "");
let transactionOngoing = false;

ws.on("open",() => {
    if (ws) sendRequest(ws);
    console.log("WebSocket is open and listening.")
})

ws.on("message",async (data:WebSocket.Data) => {
    try{
        const jsonString = data.toString();
        const parseData = JSON.parse(jsonString);

        const logs = parseData?.params?.result?.value?.logs;
        const signature = parseData?.params?.result?.value?.signature;
    
        if(Array.isArray(logs)){
            const containsCreate = logs.some((log:string) => typeof log === "string" && log.includes("Program log: initialize2: InitializeInstruction2"));

            if (!containsCreate || typeof signature !== "string") return;

            transactionOngoing = true;
            if (ws) ws.close(1000,"Handling transactions.");

            console.log("============================================");
            console.log("new liqudity pool found ");
            console.log("pause websocket to handle trasaction.");

            console.log("fetching ransaction details ...");
            const data = await fetchTransactionDetails(signature);

            if (!data){

            }
            const isRugChekPassed = await getRugCheckConfirmed(data.tokenMint);

            if (!isRugChekPassed){
                console.log(" Rug Check not passed  ");
                console.log("===================================================");
                return WebSocketHandler();
            }

            if (data.tokenMint.trim().toLowerCase().endsWith("pump") && config.liquididity_pool.ignore_pump_fun){
                console.log(" ignore pump.fun token  ");
                console.log("===================================================");
                return WebSocketHandler();
            }

            console.log(" Token found https://gmgn.ai/sol/token/"+data.tokenMint);
            const tx= await createSwapTransaction(data.solMint,data.tokenMint);

            if (!tx){

            }


        }
    }catch(error){

    }


})
ws.on("error",(err:Error) => {
    console.error("WebSocket ERROR :",err)
})
ws.on("close",() => {
    ws =null;
    if(!transactionOngoing){
        console.log("webSocket closed : Sleep 3 sec")
        setTimeout(WebSocketHandler,3000)
    }
})


}



WebSocketHandler();