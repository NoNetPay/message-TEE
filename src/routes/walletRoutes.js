const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');

router.get('/getBalance/:address', walletController.getWalletBalance);
router.get('/getBlockNumber', walletController.getBlockNumber);


module.exports = router;