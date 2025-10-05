import express from 'express';

const router = express.Router();

// Get transaction history
router.get('/history', (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  
  res.json({
    success: true,
    data: {
      transactions: [
        {
          id: '1',
          type: 'payment',
          amount: 100,
          currency: 'USD',
          status: 'completed',
          createdAt: new Date().toISOString()
        }
      ],
      pagination: {
        currentPage: parseInt(page),
        totalPages: 1,
        totalCount: 1
      }
    }
  });
});

// Create new transaction
router.post('/create', (req, res) => {
  res.json({
    success: true,
    data: {
      transactionId: Date.now().toString(),
      status: 'pending'
    }
  });
});

export default router;