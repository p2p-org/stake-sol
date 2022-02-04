const web3 = require("@solana/web3.js");
const prompt = require('prompt-sync')({sigint: true});

async function main(){
    let connection = new web3.Connection(web3.clusterApiUrl('mainnet-beta'), 'confirmed');

    let privateKeyBytesStr = prompt("Enter your private key as bytes (UInt8) array (ex. [255,255,255,...,255])\n");
    let privateKeyBytes = JSON.parse(privateKeyBytesStr);
    let keypair = web3.Keypair.fromSecretKey(Uint8Array.from(privateKeyBytes));
    console.log("\n\n\n\n\n")
    console.log(keypair.publicKey.toBase58());

    // We need to create stake account for staking.
    let stakeAccount = web3.Keypair.generate();
    
    let minBalanceForRentExemption = await connection.getMinimumBalanceForRentExemption(web3.StakeProgram.space);
    
    let lamportsToStake = prompt(`Enter amount of lamports to deposit on stake account (1 sol = 1000000000 lamports (1 billion)). Current minimal balance for rent exemption: ${minBalanceForRentExemption}: `);

    let createStakeAccountTransaction = web3.StakeProgram.createAccount({
        fromPubkey: keypair.publicKey,
        authorized: new web3.Authorized(keypair.publicKey, keypair.publicKey),
        lamports: lamportsToStake,
        lockup: new web3.Lockup(0, 0, keypair.publicKey),
        stakePubkey: stakeAccount.publicKey
    });
    let trxSign = await web3.sendAndConfirmTransaction(connection, createStakeAccountTransaction, [keypair, stakeAccount]);

    console.log(`Stake account creation transaction signature: ${trxSign} \nhttps://solscan.io/tx/${trxSign}`);

    // Waiting for 3 sec
    await new Promise(resolve => setTimeout(resolve, 3000));

    let stakeAccountBalance = await connection.getBalance(stakeAccount.publicKey);
    console.log(`Stake account balance: ${stakeAccountBalance}`)

    let stakeState = await connection.getStakeActivation(stakeAccount.publicKey);
    console.log(`Your stake state is ${stakeState.state}. Making deposit to activate stake account.`);

    // P2P Validator vote public key on solana mainnet-beta
    let votePubkey = new web3.PublicKey('FKsC411dik9ktS6xPADxs4Fk2SCENvAiuccQHLAPndvk');

    // We can then delegate our stake to the voteAccount
    let delegateTransaction = web3.StakeProgram.delegate({
        stakePubkey: stakeAccount.publicKey,
        authorizedPubkey: keypair.publicKey,
        votePubkey: votePubkey,
    });

    let delegateSignature = await web3.sendAndConfirmTransaction(connection, delegateTransaction, [keypair]);
    console.log(`Delegation transaction signature: ${delegateSignature} \nhttps://solscan.io/tx/${delegateSignature}`);

    // Waiting for 3 sec
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Getting trx info 
    let processedDelegateTrx = await connection.getTransaction(delegateSignature, "confirmed");
    console.log(`Delegation transaction info ${processedDelegateTrx.transaction.JSON}`);

    // We can verify the state of our stake. This may take some time to become active but it should be already activating at least
    stakeState = await connection.getStakeActivation(stakeAccount.publicKey);
    console.log(`Stake state: ${stakeState.state}`);

    let witdrawAnswer = prompt(`Print "Yes" to deactivate and withdraw your stake or anything else to exit: `);

    if (witdrawAnswer.toLowerCase().trim() === "yes") {
        // To withdraw our funds, we first have to deactivate the stake
        let deactivateTransaction = web3.StakeProgram.deactivate({
            stakePubkey: stakeAccount.publicKey,
            authorizedPubkey: keypair.publicKey,
        });
        let deactivateSignature = await web3.sendAndConfirmTransaction(connection, deactivateTransaction, [keypair, keypair]);
        console.log(`Deactivation transaction signature: ${deactivateSignature} \nhttps://solscan.io/tx/${deactivateSignature}`);

        // We can verify the state of our stake. It should be deactivating
        stakeState = await connection.getStakeActivation(stakeAccount.publicKey);
        console.log(`Stake state: ${stakeState.state}`);

        // Once deactivated, we can withdraw our funds
        let withdrawTransaction = web3.StakeProgram.withdraw({
            stakePubkey: stakeAccount.publicKey,
            authorizedPubkey: keypair.publicKey,
            toPubkey: keypair.publicKey,
            lamports: stakeAccountBalance,
        });

        await web3.sendAndConfirmTransaction(connection, withdrawTransaction, [keypair, keypair]);
    }

    console.log("Thank you for staking solana with us and goodbye!")
}

_ = main()