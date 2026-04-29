const express = require('express');
const router = express.Router();
const relatorioController = require('../controllers/relatorioController');

router.get('/dashboard', relatorioController.obterResumoDashboard);

module.exports = router;