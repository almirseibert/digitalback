const express = require('express');
const router = express.Router();
const prospeccaoController = require('../controllers/prospeccaoController');

router.get('/categorias', prospeccaoController.categorias);
router.get('/config', prospeccaoController.config);
router.get('/geocode', prospeccaoController.geocode);
router.post('/buscar', prospeccaoController.buscar);
router.post('/importar', prospeccaoController.importar);

module.exports = router;
