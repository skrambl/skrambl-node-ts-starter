import axios from 'axios';
import nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import pino from 'pino';
import cron from 'cron';
import { Buffer } from 'buffer';
dotenv.config();

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

function base64Decode(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf8');
}

const CRON = base64Decode(process.env.CRON!);
const COINBASE_API_KEY = base64Decode(process.env.COINBASE_API_KEY!);
const COINBASE_API_SECRET = base64Decode(process.env.COINBASE_API_SECRET!);
const COINBASE_API_PASSPHRASE = base64Decode(process.env.COINBASE_API_PASSPHRASE!);
const EMAIL_RECIPIENT = base64Decode(process.env.EMAIL_RECIPIENT!);
const EMAIL_USER = base64Decode(process.env.EMAIL_USER!);
const EMAIL_PASS = base64Decode(process.env.EMAIL_PASS!);
const WALLET_ADDRESS = base64Decode(process.env.WALLET_ADDRESS!);
const CURRENCY = base64Decode(process.env.CURRENCY!);

// Setup email transporter
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

// Email utility
async function sendEmail(subject: string, text: string) {
  try {
    await emailTransporter.sendMail({
      from: EMAIL_USER,
      to: EMAIL_RECIPIENT,
      subject,
      text
    });
  } catch (error) {
    logger.error('Error sending email:', error);
  }
}

// Coinbase API functions
async function fetchCoinbaseAccounts(): Promise<any[]> {
  const startTime = Date.now();
  logger.info('Fetching Coinbase accounts');
  const response = await axios.get('https://api.pro.coinbase.com/accounts', {
    headers: {
      'CB-ACCESS-KEY': COINBASE_API_KEY,
      'CB-ACCESS-SIGN': COINBASE_API_SECRET,
      'CB-ACCESS-PASSPHRASE': COINBASE_API_PASSPHRASE
    }
  });
  logger.info(`Fetched Coinbase accounts successfully (${Date.now() - startTime}ms)`);
  return response.data;
}

async function transfer(currency: string, amount: number, address: string): Promise<void> {
  const startTime = Date.now();
  logger.info(`Transferring ${amount} ${currency} to address ${address}`);
  await axios.post('https://api.pro.coinbase.com/withdrawals/crypto', {
    currency,
    amount: amount.toFixed(2),
    crypto_address: address
  }, {
    headers: {
      'CB-ACCESS-KEY': COINBASE_API_KEY,
      'CB-ACCESS-SIGN': COINBASE_API_SECRET,
      'CB-ACCESS-PASSPHRASE': COINBASE_API_PASSPHRASE
    }
  });
  logger.info(`Transferred ${amount} ${currency} to address ${address} (${Date.now() - startTime}ms)`);
}

// Business logic functions
function getBalance(currency: string, accounts: any[]): number {
  const account = accounts.find((acc: any) => acc.currency === currency);
  return account ? parseFloat(account.balance) : 0;
}

async function run() {
  const startTime = Date.now();
  logger.info(`Starting job`);
  let status = 'success';

  try {
    const accounts = await fetchCoinbaseAccounts();
    const balance = getBalance(CURRENCY, accounts);
    logger.info(`Balance: ${balance} ${CURRENCY}`);

    if (balance > 0) {
      await transfer(CURRENCY, balance, WALLET_ADDRESS);
      await sendEmail('Coinbase transfer to local wallet success', `Transferred ${balance} ${CURRENCY} to address ${WALLET_ADDRESS}.`);
    } else {
      logger.info(`No ${CURRENCY} balance to transfer`);
      await sendEmail('Coinbase transfer to local wallet not executed', `Transfer of ${CURRENCY} to address ${WALLET_ADDRESS} not executed because balance ${balance} ${CURRENCY} is too low.`);
      status = 'balance too low';
    }
  } catch (error) {
    logger.error('Error:', error);
    await sendEmail('Coinbase transfer to local wallet error', `Transfer of ${CURRENCY} to address ${WALLET_ADDRESS} failed.`);
    status = 'error';
  }

  logger.info(`Finished job, status: ${status} (${Date.now() - startTime}ms)`);
}

const job = new cron.CronJob(CRON, run);
job.start();

logger.info(`Started, cron: ${CRON}`);