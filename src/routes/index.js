const express = require('express');
const router = express.Router();
const messageRoutes = require('./messageRoutes');
const walletRoutes = require('./walletRoutes');

router.use('/messages', messageRoutes);
router.use('/wallet', walletRoutes);


module.exports = router;