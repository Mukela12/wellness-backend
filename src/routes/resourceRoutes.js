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

router.get('/category/:category', resourceController.getResourcesByCategory);

router.get('/', resourceController.getAllResources);

router.post('/', authorize(['hr', 'admin', 'manager']), validateResource, resourceController.createResource);

router.get('/:id', resourceController.getResource);

router.put('/:id', authorize(['hr', 'admin', 'manager']), resourceController.updateResource);

router.delete('/:id', authorize(['hr', 'admin', 'manager']), resourceController.deleteResource);

router.post('/:id/interact', validateResourceInteraction, resourceController.interactWithResource);

router.get('/:id/analytics', authorize(['hr', 'admin', 'manager']), resourceController.getResourceAnalytics);

router.patch('/:id/status', authorize(['hr', 'admin', 'manager']), resourceController.updateResourceStatus);

module.exports = router;