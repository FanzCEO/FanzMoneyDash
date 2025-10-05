import express from 'express';

const router = express.Router();

// Get current user profile
router.get('/profile', (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user
    }
  });
});

// Update user profile
router.put('/profile', (req, res) => {
  res.json({
    success: true,
    message: 'Profile updated successfully'
  });
});

export default router;