const { Resource, ResourceInteraction } = require('../models/Resource');
const User = require('../models/User');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/responseUtils');
const mongoose = require('mongoose');

const resourceController = {
  async createResource(req, res) {
    try {
      const {
        title,
        description,
        shortDescription,
        type,
        category,
        subcategory,
        content,
        difficulty,
        tags,
        author,
        source,
        readingTime,
        featured,
        targetAudience,
        prerequisites,
        learningObjectives,
        attachments,
        language,
        accessibility,
        expiryDate
      } = req.body;

      const resource = new Resource({
        title,
        description,
        shortDescription,
        type,
        category,
        subcategory,
        content,
        difficulty,
        tags,
        author,
        source,
        readingTime,
        featured,
        targetAudience,
        prerequisites,
        learningObjectives,
        attachments,
        language,
        accessibility,
        expiryDate,
        createdBy: req.user.id
      });

      await resource.save();

      sendSuccessResponse(res, {
        message: 'Resource created successfully',
        data: { resource }
      }, 201);
    } catch (error) {
      console.error('Error creating resource:', error);
      sendErrorResponse(res, 'Failed to create resource', 500);
    }
  },

  async getAllResources(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        type,
        difficulty,
        featured,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (page - 1) * limit;
      const query = { status: 'published' };

      if (category) query.category = category;
      if (type) query.type = type;
      if (difficulty) query.difficulty = difficulty;
      if (featured !== undefined) query.featured = featured === 'true';

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ];
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const resources = await Resource.find(query)
        .populate('createdBy', 'name')
        .populate('relatedResources', 'title type category')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));

      const filteredResources = resources.filter(resource =>
        resource.hasUserAccess(req.user)
      );

      const total = await Resource.countDocuments(query);

      sendSuccessResponse(res, {
        message: 'Resources retrieved successfully',
        data: {
          resources: filteredResources,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalCount: total,
            hasNext: page < Math.ceil(total / limit),
            hasPrev: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Error fetching resources:', error);
      sendErrorResponse(res, 'Failed to fetch resources', 500);
    }
  },

  async getResource(req, res) {
    try {
      const { id } = req.params;

      const resource = await Resource.findById(id)
        .populate('createdBy', 'name')
        .populate('relatedResources', 'title type category readingTime');

      if (!resource) {
        return sendErrorResponse(res, 'Resource not found', 404);
      }

      if (!resource.hasUserAccess(req.user)) {
        return sendErrorResponse(res, 'Access denied', 403);
      }

      await resource.incrementViews();

      let userInteraction = await ResourceInteraction.findOne({
        userId: req.user.id,
        resourceId: id
      });

      if (!userInteraction) {
        userInteraction = new ResourceInteraction({
          userId: req.user.id,
          resourceId: id,
          interactions: { viewed: true }
        });
        await userInteraction.save();
      } else {
        userInteraction.interactions.viewed = true;
        userInteraction.lastAccessedAt = new Date();
        await userInteraction.save();
      }

      sendSuccessResponse(res, {
        message: 'Resource retrieved successfully',
        data: {
          resource,
          userInteraction: userInteraction || null
        }
      });
    } catch (error) {
      console.error('Error fetching resource:', error);
      sendErrorResponse(res, 'Failed to fetch resource', 500);
    }
  },

  async updateResource(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const resource = await Resource.findById(id);

      if (!resource) {
        return sendErrorResponse(res, 'Resource not found', 404);
      }

      if (req.user.role !== 'hr' && req.user.role !== 'admin' &&
          resource.createdBy.toString() !== req.user.id) {
        return sendErrorResponse(res, 'Access denied', 403);
      }

      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          resource[key] = updates[key];
        }
      });

      resource.lastUpdatedBy = req.user.id;
      await resource.save();

      sendSuccessResponse(res, {
        message: 'Resource updated successfully',
        data: { resource }
      });
    } catch (error) {
      console.error('Error updating resource:', error);
      sendErrorResponse(res, 'Failed to update resource', 500);
    }
  },

  async deleteResource(req, res) {
    try {
      const { id } = req.params;

      const resource = await Resource.findById(id);

      if (!resource) {
        return sendErrorResponse(res, 'Resource not found', 404);
      }

      if (req.user.role !== 'hr' && req.user.role !== 'admin' &&
          resource.createdBy.toString() !== req.user.id) {
        return sendErrorResponse(res, 'Access denied', 403);
      }

      await Resource.findByIdAndDelete(id);
      await ResourceInteraction.deleteMany({ resourceId: id });

      sendSuccessResponse(res, {
        message: 'Resource deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting resource:', error);
      sendErrorResponse(res, 'Failed to delete resource', 500);
    }
  },

  async getFeaturedResources(req, res) {
    try {
      const { limit = 6 } = req.query;

      const resources = await Resource.getFeaturedResources(parseInt(limit));

      const filteredResources = resources.filter(resource =>
        resource.hasUserAccess(req.user)
      );

      sendSuccessResponse(res, {
        message: 'Featured resources retrieved successfully',
        data: {
          resources: filteredResources,
          count: filteredResources.length
        }
      });
    } catch (error) {
      console.error('Error fetching featured resources:', error);
      sendErrorResponse(res, 'Failed to fetch featured resources', 500);
    }
  },

  async getPopularResources(req, res) {
    try {
      const { limit = 10 } = req.query;

      const resources = await Resource.getPopularResources(parseInt(limit));

      const filteredResources = resources.filter(resource =>
        resource.hasUserAccess(req.user)
      );

      sendSuccessResponse(res, {
        message: 'Popular resources retrieved successfully',
        data: {
          resources: filteredResources,
          count: filteredResources.length
        }
      });
    } catch (error) {
      console.error('Error fetching popular resources:', error);
      sendErrorResponse(res, 'Failed to fetch popular resources', 500);
    }
  },

  async getResourcesByCategory(req, res) {
    try {
      const { category } = req.params;
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

      const resources = await Resource.getByCategory(category, {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder: sortOrder === 'desc' ? -1 : 1
      });

      const filteredResources = resources.filter(resource =>
        resource.hasUserAccess(req.user)
      );

      const total = await Resource.countDocuments({
        category,
        status: 'published'
      });

      sendSuccessResponse(res, {
        message: `Resources in ${category} category retrieved successfully`,
        data: {
          resources: filteredResources,
          category,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalCount: total
          }
        }
      });
    } catch (error) {
      console.error('Error fetching resources by category:', error);
      sendErrorResponse(res, 'Failed to fetch resources by category', 500);
    }
  },

  async interactWithResource(req, res) {
    try {
      const { id } = req.params;
      const { action, data } = req.body;

      const resource = await Resource.findById(id);

      if (!resource) {
        return sendErrorResponse(res, 'Resource not found', 404);
      }

      if (!resource.hasUserAccess(req.user)) {
        return sendErrorResponse(res, 'Access denied', 403);
      }

      let interaction = await ResourceInteraction.findOne({
        userId: req.user.id,
        resourceId: id
      });

      if (!interaction) {
        interaction = new ResourceInteraction({
          userId: req.user.id,
          resourceId: id
        });
      }

      interaction.lastAccessedAt = new Date();

      switch (action) {
        case 'like':
          const wasLiked = interaction.interactions.liked;
          interaction.interactions.liked = !wasLiked;
          resource.analytics.likes += wasLiked ? -1 : 1;
          break;

        case 'complete':
          if (!interaction.interactions.completed) {
            interaction.interactions.completed = true;
            interaction.completedAt = new Date();
            resource.analytics.completions += 1;
            
            if (data?.timeSpent) {
              interaction.progress.timeSpent = data.timeSpent;
            }
          }
          interaction.progress.percentage = 100;
          break;

        case 'bookmark':
          interaction.interactions.bookmarked = !interaction.interactions.bookmarked;
          break;

        case 'download':
          if (!interaction.interactions.downloaded) {
            interaction.interactions.downloaded = true;
            resource.analytics.downloads += 1;
          }
          break;

        case 'rate':
          if (data?.rating && data.rating >= 1 && data.rating <= 5) {
            const wasRated = !!interaction.rating.score;
            const oldRating = interaction.rating.score || 0;
            
            interaction.rating = {
              score: data.rating,
              feedback: data.feedback || '',
              ratedAt: new Date()
            };

            if (wasRated) {
              const totalScore = (resource.analytics.averageRating * resource.analytics.totalRatings) - oldRating + data.rating;
              resource.analytics.averageRating = totalScore / resource.analytics.totalRatings;
            } else {
              await resource.updateRating(data.rating);
            }
          }
          break;

        case 'update_progress':
          if (data?.percentage !== undefined) {
            interaction.progress.percentage = Math.min(Math.max(data.percentage, 0), 100);
          }
          if (data?.lastPosition) {
            interaction.progress.lastPosition = data.lastPosition;
          }
          if (data?.timeSpent) {
            interaction.progress.timeSpent = data.timeSpent;
          }
          break;

        case 'add_notes':
          if (data?.notes) {
            interaction.notes = data.notes;
          }
          break;

        default:
          return sendErrorResponse(res, 'Invalid action', 400);
      }

      await interaction.save();
      await resource.save();

      sendSuccessResponse(res, {
        message: `Resource ${action} action completed successfully`,
        data: {
          interaction,
          resourceAnalytics: resource.analytics
        }
      });
    } catch (error) {
      console.error('Error interacting with resource:', error);
      sendErrorResponse(res, 'Failed to interact with resource', 500);
    }
  },

  async getUserResourceHistory(req, res) {
    try {
      const { page = 1, limit = 20, filter } = req.query;
      const skip = (page - 1) * limit;

      const query = { userId: req.user.id };

      if (filter) {
        switch (filter) {
          case 'bookmarked':
            query['interactions.bookmarked'] = true;
            break;
          case 'completed':
            query['interactions.completed'] = true;
            break;
          case 'liked':
            query['interactions.liked'] = true;
            break;
          case 'in_progress':
            query['interactions.completed'] = false;
            query['progress.percentage'] = { $gt: 0, $lt: 100 };
            break;
        }
      }

      const interactions = await ResourceInteraction.find(query)
        .populate({
          path: 'resourceId',
          select: 'title type category readingTime analytics status',
          match: { status: 'published' }
        })
        .sort({ lastAccessedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const filteredInteractions = interactions.filter(interaction =>
        interaction.resourceId && interaction.resourceId.hasUserAccess(req.user)
      );

      const total = await ResourceInteraction.countDocuments(query);

      sendSuccessResponse(res, {
        message: 'User resource history retrieved successfully',
        data: {
          interactions: filteredInteractions,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalCount: total
          }
        }
      });
    } catch (error) {
      console.error('Error fetching user resource history:', error);
      sendErrorResponse(res, 'Failed to fetch user resource history', 500);
    }
  },

  async getResourceAnalytics(req, res) {
    try {
      const { id } = req.params;

      const resource = await Resource.findById(id);

      if (!resource) {
        return sendErrorResponse(res, 'Resource not found', 404);
      }

      if (req.user.role !== 'hr' && req.user.role !== 'admin' &&
          resource.createdBy.toString() !== req.user.id) {
        return sendErrorResponse(res, 'Access denied', 403);
      }

      const interactions = await ResourceInteraction.find({ resourceId: id })
        .populate('userId', 'name department');

      const analytics = {
        resource: {
          id: resource._id,
          title: resource.title,
          type: resource.type,
          category: resource.category
        },
        overview: resource.analytics,
        engagement: {
          viewsToCompletion: resource.analytics.views > 0 
            ? (resource.analytics.completions / resource.analytics.views * 100).toFixed(1)
            : 0,
          likesRate: resource.analytics.views > 0 
            ? (resource.analytics.likes / resource.analytics.views * 100).toFixed(1)
            : 0,
          downloadsRate: resource.analytics.views > 0 
            ? (resource.analytics.downloads / resource.analytics.views * 100).toFixed(1)
            : 0
        },
        userBreakdown: {
          byDepartment: {},
          byCompletion: {
            completed: 0,
            inProgress: 0,
            viewed: 0
          }
        }
      };

      interactions.forEach(interaction => {
        const dept = interaction.userId.department || 'Unknown';
        analytics.userBreakdown.byDepartment[dept] = 
          (analytics.userBreakdown.byDepartment[dept] || 0) + 1;

        if (interaction.interactions.completed) {
          analytics.userBreakdown.byCompletion.completed++;
        } else if (interaction.progress.percentage > 0) {
          analytics.userBreakdown.byCompletion.inProgress++;
        } else {
          analytics.userBreakdown.byCompletion.viewed++;
        }
      });

      sendSuccessResponse(res, {
        message: 'Resource analytics retrieved successfully',
        data: analytics
      });
    } catch (error) {
      console.error('Error fetching resource analytics:', error);
      sendErrorResponse(res, 'Failed to fetch resource analytics', 500);
    }
  },

  async updateResourceStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['draft', 'published', 'archived'].includes(status)) {
        return sendErrorResponse(res, 'Invalid status', 400);
      }

      const resource = await Resource.findById(id);

      if (!resource) {
        return sendErrorResponse(res, 'Resource not found', 404);
      }

      if (req.user.role !== 'hr' && req.user.role !== 'admin' &&
          resource.createdBy.toString() !== req.user.id) {
        return sendErrorResponse(res, 'Access denied', 403);
      }

      const oldStatus = resource.status;
      resource.status = status;
      resource.lastUpdatedBy = req.user.id;

      if (status === 'published' && !resource.publishedAt) {
        resource.publishedAt = new Date();
      }

      await resource.save();

      sendSuccessResponse(res, {
        message: `Resource status updated from ${oldStatus} to ${status}`,
        data: {
          resourceId: resource._id,
          oldStatus,
          newStatus: status
        }
      });
    } catch (error) {
      console.error('Error updating resource status:', error);
      sendErrorResponse(res, 'Failed to update resource status', 500);
    }
  },

  async getResourceCategories(req, res) {
    try {
      const categories = [
        {
          id: 'mental_health',
          name: 'Mental Health',
          description: 'Resources for maintaining and improving mental wellness',
          icon: '🧠'
        },
        {
          id: 'stress_management',
          name: 'Stress Management',
          description: 'Techniques and strategies for managing workplace stress',
          icon: '😌'
        },
        {
          id: 'mindfulness',
          name: 'Mindfulness & Meditation',
          description: 'Mindfulness practices and meditation guides',
          icon: '🧘'
        },
        {
          id: 'fitness',
          name: 'Physical Fitness',
          description: 'Exercise routines and physical wellness tips',
          icon: '💪'
        },
        {
          id: 'nutrition',
          name: 'Nutrition & Diet',
          description: 'Healthy eating habits and nutritional guidance',
          icon: '🥗'
        },
        {
          id: 'sleep',
          name: 'Sleep Health',
          description: 'Sleep hygiene and rest optimization strategies',
          icon: '😴'
        },
        {
          id: 'work_life_balance',
          name: 'Work-Life Balance',
          description: 'Balancing professional and personal life',
          icon: '⚖️'
        },
        {
          id: 'team_building',
          name: 'Team Building',
          description: 'Resources for improving team dynamics and collaboration',
          icon: '🤝'
        },
        {
          id: 'leadership',
          name: 'Leadership & Management',
          description: 'Leadership skills and management techniques',
          icon: '👨‍💼'
        },
        {
          id: 'productivity',
          name: 'Productivity',
          description: 'Tools and techniques for enhanced productivity',
          icon: '📈'
        }
      ];

      for (const category of categories) {
        const count = await Resource.countDocuments({
          category: category.id,
          status: 'published'
        });
        category.resourceCount = count;
      }

      sendSuccessResponse(res, {
        message: 'Resource categories retrieved successfully',
        data: { categories }
      });
    } catch (error) {
      console.error('Error fetching resource categories:', error);
      sendErrorResponse(res, 'Failed to fetch resource categories', 500);
    }
  }
};

module.exports = resourceController;