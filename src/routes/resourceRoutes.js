const express = require('express');
const router = express.Router();
const resourceController = require('../controllers/resourceController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateResource, validateResourceInteraction } = require('../middleware/validation/resourceValidation');

router.use(authenticate);

router.get('/categories', resourceController.getResourceCategories);

router.get('/featured', resourceController.getFeaturedResources);

router.get('/popular', resourceController.getPopularResources);

router.get('/my-history', resourceController.getUserResourceHistory);

router.get('/favorites', resourceController.getUserFavorites);

router.get('/category/:category', resourceController.getResourcesByCategory);

router.get('/', resourceController.getAllResources);

router.post('/', authorize(['admin']), validateResource, resourceController.createResource);

router.get('/:id', resourceController.getResource);

router.put('/:id', authorize(['admin']), resourceController.updateResource);

router.delete('/:id', authorize(['admin']), resourceController.deleteResource);

router.post('/:id/interact', validateResourceInteraction, resourceController.interactWithResource);

router.post('/:id/favorite', resourceController.addToFavorites);

router.delete('/:id/favorite', resourceController.removeFromFavorites);

router.get('/:id/analytics', authorize(['admin']), resourceController.getResourceAnalytics);

router.patch('/:id/status', authorize(['admin']), resourceController.updateResourceStatus);

module.exports = router;