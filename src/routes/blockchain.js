import express from 'express';
import Web3 from 'web3';
import BlockchainService from '../services/blockchainService.js';
import authMiddleware from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();
const blockchainService = new BlockchainService();

// Get blockchain transaction history
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { page = 1, limit = 20, type, status } = req.query;

    const transactions = await blockchainService.getTransactionHistory({
      userId,
      page: parseInt(page),
      limit: parseInt(limit),
      type,
      status
    });

    res.json({
      success: true,
      data: {
        transactions: transactions.data,
        pagination: {
          currentPage: parseInt(page),
          totalPages: transactions.totalPages,
          totalCount: transactions.totalCount,
          hasMore: transactions.hasMore
        }
      }
    });
  } catch (error) {
    console.error('Blockchain transaction history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get blockchain transaction history'
    });
  }
});

// Verify transaction on blockchain
router.post('/verify', [
  authMiddleware,
  body('transactionHash').isLength({ min: 64, max: 66 }),
  body('network').optional().isIn(['ethereum', 'polygon', 'bsc'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { transactionHash, network = 'ethereum' } = req.body;

    const verification = await blockchainService.verifyTransaction(transactionHash, network);

    res.json({
      success: true,
      data: {
        verification,
        transactionHash,
        network,
        verifiedAt: new Date().toISOString(),
        status: verification.status,
        confirmations: verification.confirmations,
        blockNumber: verification.blockNumber
      }
    });
  } catch (error) {
    console.error('Transaction verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify transaction'
    });
  }
});

// Connect wallet
router.post('/wallet/connect', [
  authMiddleware,
  body('walletAddress').matches(/^0x[a-fA-F0-9]{40}$/),
  body('signature').isLength({ min: 1 }),
  body('message').isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { userId } = req.user;
    const { walletAddress, signature, message } = req.body;

    const walletConnection = await blockchainService.connectWallet({
      userId,
      walletAddress,
      signature,
      message
    });

    res.json({
      success: true,
      data: {
        wallet: walletConnection,
        connected: true,
        connectedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Wallet connection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect wallet'
    });
  }
});

// Get wallet balance
router.get('/wallet/balance', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { walletAddress, tokens } = req.query;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }

    const balances = await blockchainService.getWalletBalance(
      walletAddress,
      tokens ? tokens.split(',') : undefined
    );

    res.json({
      success: true,
      data: {
        balances,
        walletAddress,
        checkedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Wallet balance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get wallet balance'
    });
  }
});

// Create smart contract transaction
router.post('/contract/execute', [
  authMiddleware,
  body('contractAddress').matches(/^0x[a-fA-F0-9]{40}$/),
  body('method').isLength({ min: 1 }),
  body('parameters').isArray().optional(),
  body('value').optional().isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { userId } = req.user;
    const { contractAddress, method, parameters = [], value = 0 } = req.body;

    const transaction = await blockchainService.executeContract({
      userId,
      contractAddress,
      method,
      parameters,
      value
    });

    res.json({
      success: true,
      data: {
        transaction,
        transactionHash: transaction.hash,
        status: 'pending',
        estimatedConfirmation: transaction.estimatedConfirmation
      }
    });
  } catch (error) {
    console.error('Contract execution error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute smart contract'
    });
  }
});

// Get smart contract details
router.get('/contract/:address', authMiddleware, async (req, res) => {
  try {
    const { address } = req.params;

    if (!Web3.utils.isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid contract address'
      });
    }

    const contractDetails = await blockchainService.getContractDetails(address);

    res.json({
      success: true,
      data: {
        contract: contractDetails,
        address,
        retrievedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Contract details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get contract details'
    });
  }
});

// Create payment request with crypto
router.post('/payment/create', [
  authMiddleware,
  body('amount').isNumeric(),
  body('currency').isIn(['ETH', 'BTC', 'USDC', 'USDT', 'BNB']),
  body('recipient').isLength({ min: 1 }),
  body('description').optional().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { userId } = req.user;
    const { amount, currency, recipient, description, expiresIn = 3600 } = req.body;

    const paymentRequest = await blockchainService.createPaymentRequest({
      userId,
      amount,
      currency,
      recipient,
      description,
      expiresIn
    });

    res.json({
      success: true,
      data: {
        paymentRequest,
        qrCode: paymentRequest.qrCode,
        paymentUrl: paymentRequest.paymentUrl,
        expiresAt: paymentRequest.expiresAt
      }
    });
  } catch (error) {
    console.error('Payment request creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment request'
    });
  }
});

// Get payment status
router.get('/payment/:paymentId/status', authMiddleware, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { userId } = req.user;

    const paymentStatus = await blockchainService.getPaymentStatus(userId, paymentId);

    res.json({
      success: true,
      data: {
        payment: paymentStatus,
        paymentId,
        checkedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment status'
    });
  }
});

// DeFi integration - Get yield opportunities
router.get('/defi/yield', authMiddleware, async (req, res) => {
  try {
    const { protocol, minApy, riskLevel } = req.query;

    const yieldOpportunities = await blockchainService.getYieldOpportunities({
      protocol,
      minApy: minApy ? parseFloat(minApy) : undefined,
      riskLevel
    });

    res.json({
      success: true,
      data: {
        opportunities: yieldOpportunities,
        disclaimer: 'DeFi investments carry risks. Please do your own research.',
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('DeFi yield opportunities error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get yield opportunities'
    });
  }
});

// Staking operations
router.post('/staking/stake', [
  authMiddleware,
  body('protocol').isIn(['ethereum2', 'polygon', 'cardano', 'solana']),
  body('amount').isNumeric(),
  body('duration').optional().isInt({ min: 1, max: 365 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { userId } = req.user;
    const { protocol, amount, duration } = req.body;

    const stakingTransaction = await blockchainService.stakeTokens({
      userId,
      protocol,
      amount,
      duration
    });

    res.json({
      success: true,
      data: {
        staking: stakingTransaction,
        transactionHash: stakingTransaction.hash,
        expectedRewards: stakingTransaction.expectedRewards,
        unlockDate: stakingTransaction.unlockDate
      }
    });
  } catch (error) {
    console.error('Staking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stake tokens'
    });
  }
});

// Get gas price estimates
router.get('/gas/estimate', async (req, res) => {
  try {
    const { network = 'ethereum', transactionType = 'transfer' } = req.query;

    const gasEstimates = await blockchainService.getGasEstimates(network, transactionType);

    res.json({
      success: true,
      data: {
        gasEstimates,
        network,
        transactionType,
        estimatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Gas estimation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get gas estimates'
    });
  }
});

// Blockchain network status
router.get('/network/status', async (req, res) => {
  try {
    const { network = 'ethereum' } = req.query;

    const networkStatus = await blockchainService.getNetworkStatus(network);

    res.json({
      success: true,
      data: {
        network: networkStatus,
        checkedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Network status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get network status'
    });
  }
});

export default router;