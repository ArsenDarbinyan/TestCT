import axios from "axios";
import {Conneciton,Keypair,VersionedTransaction} from "@solana/web3.js";
import {Wallet} from "@project-serium/anchor";
import bs58 from "bs58";
import dotenv from "dotenv";
import {config} from "./config";
import {TransactionDetailsResponseArray, DisplayDataItem ,QuoteResponse,SerializedQuoteResponse,RugResponse} from "./types";



dotenv.config();

export async function fetchTransactionDetails(signature:string):Promise<DisplayDataItem |null> {
    const API_URL = process.env.HELIUS_HTTPS_URI_TX || "";
    const startTime = Date.now();

    while(Date.now()-startTime<config.tx.get_retry_timeout){
        try{
            const response = await axios.post<any>(
                API_URL,
                {transactions: [signature]},
                {
                    headers:{
                        "Content_Type":"application/json",

                    },
                    timeout:3000,

                }
            );
            if(response.data && response.data.length > 0){
                const transactions : TransactionDetailsResponseArray = response.data;

                const instructions = transactions[0]?.instructions;
                
                if(!instructions || instructions.length === 0){
                    console.log("...?");
                    return null ;
                }

                const instruction = instructions.find((ix)=>ix.programId === config.liqudity_pool.radium_program_id);

                if(!instructions || instructions.accounts){
                    console.log("no instructions  skipping LP");
                    return null ;
                }

                const accounts = instructions.accounts
                const accountsOne = accounts[8];
                const accountsTwo = accounts[9];
                let solTokenAccount = "";
                let newTokenAccount = "";
                if(accountsOne===config.liqudity_pool.wsol_pc_mint){
                    solTokenAccount = accountsOne;
                    newTokenAccount = accountsTwo;
                }else{
                    solTokenAccount = accountsTwo;
                    newTokenAccount = accountsOne;
                }
                
                const displayData: DisplayDataItem={
                    tokenMint: newTokenAccount,
                    solMint:solTokenAccount,
                };
                return displayData;                
            }

        
        }catch(error:any){
            console.log("trasactions:fetchTransactionDetails:error",error)
        }

        await new Promise((resolve)=>setTimeout(resolve,config.tx.get_retry_interval));
    }

    console.log("Timeout exceeded. No data returned");
    return null;
}


export async function createSwapTransaction(solMint:string,tokenMint:string): Promise<any> {
    const quoteUrl = process.env.JUP_HTTPS_QUOTE_URL || "";
    const swapUrl = process.env.JUP_HTTPS_QUOTE_URL || "";
    const rpcUrl = process.env.HELIUS_HTTPS_URI || "";
    const myWallet = new Wallet(Keypair.fromSecretKey(bs58.decode( process.env.PRIV_KEY_WALLET || "")));

    try{

        const quoteResponse  = await axios.get<QuoteResponse>(quoteUrl,{
            params:{
                inputMint:solMint,
                outputMint:tokenMint,
                amount:config.swap.amount,
                slipageBps:config.swap.slipageBps,
            },
            timeout:3000,
        })

        if (!quoteResponse.data)return null;

        
        const swapTransaction = await axios.post<SerializedQuoteResponse>(
            swapUrl,
            JSON.stringify({
                quoteResponse: quoteResponse.data,
                userPuplicKey:myWallet.publicKey.toString(),
                wrapAndUnwrapSol:true,
                dynamicSlipage:{
                    maxBps:300,
                },
                prioritizationFeeLamports:{
                    priorityLevelWithMaxLamports:{
                        maxLamports:1000000,
                        priorityLevel: "veryHight",
                    },
                },
            }),
            {
                heandlers:{
                    "Content-Type":"application/json",
                },
                timeout:3000,
            }
        );
        if (!swapTransaction.data) return null;


    }catch(error:any){
        console.log("trasactions:fetchTransactionDetails:error while creating and submitting transaction:",error.message )
        return null;
    }
    
}
export async function getRugCheckConfirmed(tokenMint:string):Promise<boolean> {
    const rugResponse = await axios.get<RugResponse>("https://api.rugchek.xyz/v1/tokens/"+tokenMint+"/report/summary",
        {});
         
    if (!rugResponse.data) return false;

    for (const risk of rugResponse.data.risks){
        if(risk.name === "Single holders ownership"){
            const numericValue = parseFloat(risk.value.replace("%",""));
            if(numericValue > config.rug_chek.single_holder_ownership){
                return false;
            }
        }
    }

    function isRiskAcceptable(tokenDetails:RugResponse):boolean{
        const notAllowed = config.rug_chek.not_allowed;
        return !tokenDetails.risks.some((risk)=>notAllowed.includes(risk.name))
    }

    return isRiskAcceptable(rugResponse.data)
}






