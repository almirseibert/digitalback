const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');

router.get('/estagios', leadController.estagios);
router.get('/', leadController.listar);
router.post('/', leadController.criar);
router.get('/:id', leadController.detalhe);
router.put('/:id', leadController.atualizar);
router.put('/:id/status', leadController.mudarStatus);
router.put('/:id/atribuir', leadController.atribuir);
router.post('/:id/interacoes', leadController.registrarInteracao);

module.exports = router;
