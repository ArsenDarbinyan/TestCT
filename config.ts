export const config = {
    liquidity_pool:{
        ignore_pump_fun:true,
        radium_program_id:"",
        wsol_pc_mint:"",
    },
    tx:{
        get_retry_interval:600,
        get_retry_timeout:20000,
    },
    swap: {
        amount:"1000000" ,//0.001
        slippageBps:"200",//2%
    },
    rug_chek:{
        single_holder_ownership:30,
        not_allowed:["Freeze Authority still enabled","Large Amount of LP Unlocked","Copycat token"],
    }
}
