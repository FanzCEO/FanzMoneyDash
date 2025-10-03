/**
 * FANZ AI-Powered Fraud Detection Service
 * Advanced machine learning-based fraud detection and risk assessment
 */

const tf = require('@tensorflow/tfjs-node');
const redis = require('redis');
const { PrismaClient } = require('@prisma/client');
const { logger } = require('../utils/logger');
const { encrypt, decrypt } = require('../utils/encryption');

class AIFraudDetectionService {
    constructor() {
        this.prisma = new PrismaClient();
        this.redisClient = redis.createClient({
            url: process.env.REDIS_URL
        });
        this.model = null;
        this.isModelLoaded = false;
        this.featureExtractor = new FeatureExtractor();
        this.riskThresholds = {
            LOW: 0.3,
            MEDIUM: 0.6,
            HIGH: 0.8,
            CRITICAL: 0.95
        };
    }

    async initialize() {
        try {
            await this.redisClient.connect();
            await this.loadModel();
            await this.initializeFeatureStore();
            logger.info('AI Fraud Detection Service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize AI Fraud Detection Service:', error);
            throw error;
        }
    }

    async loadModel() {
        try {
            // Try to load existing model, otherwise create new one
            try {
                this.model = await tf.loadLayersModel('file://./models/fraud-detection/model.json');
                logger.info('Loaded existing fraud detection model');
            } catch (error) {
                logger.info('Creating new fraud detection model');
                this.model = await this.createNewModel();
                await this.trainInitialModel();
            }
            this.isModelLoaded = true;
        } catch (error) {
            logger.error('Failed to load/create fraud detection model:', error);
            throw error;
        }
    }

    createNewModel() {
        const model = tf.sequential({
            layers: [
                tf.layers.dense({
                    inputShape: [50], // 50 features
                    units: 128,
                    activation: 'relu',
                    kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
                }),
                tf.layers.dropout({ rate: 0.3 }),
                tf.layers.dense({
                    units: 64,
                    activation: 'relu',
                    kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
                }),
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.dense({
                    units: 32,
                    activation: 'relu'
                }),
                tf.layers.dense({
                    units: 1,
                    activation: 'sigmoid'
                })
            ]
        });

        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'binaryCrossentropy',
            metrics: ['accuracy', 'precision', 'recall']
        });

        return model;
    }

    async trainInitialModel() {
        try {
            // Get historical transaction data for training
            const trainingData = await this.getTrainingData();
            
            if (trainingData.features.length < 1000) {
                logger.warn('Insufficient training data, using synthetic data generation');
                await this.generateSyntheticTrainingData();
            }

            const { features, labels } = await this.prepareTrainingData(trainingData);
            
            // Split data into training and validation sets
            const splitIndex = Math.floor(features.length * 0.8);
            const xTrain = features.slice(0, splitIndex);
            const yTrain = labels.slice(0, splitIndex);
            const xVal = features.slice(splitIndex);
            const yVal = labels.slice(splitIndex);

            // Convert to tensors
            const xTrainTensor = tf.tensor2d(xTrain);
            const yTrainTensor = tf.tensor2d(yTrain, [yTrain.length, 1]);
            const xValTensor = tf.tensor2d(xVal);
            const yValTensor = tf.tensor2d(yVal, [yVal.length, 1]);

            // Train the model
            await this.model.fit(xTrainTensor, yTrainTensor, {
                epochs: 50,
                batchSize: 32,
                validationData: [xValTensor, yValTensor],
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        if (epoch % 10 === 0) {
                            logger.info(`Training epoch ${epoch}: loss=${logs.loss.toFixed(4)}, accuracy=${logs.acc.toFixed(4)}`);
                        }
                    }
                }
            });

            // Save the trained model
            await this.model.save('file://./models/fraud-detection');
            
            // Cleanup tensors
            xTrainTensor.dispose();
            yTrainTensor.dispose();
            xValTensor.dispose();
            yValTensor.dispose();

            logger.info('Initial model training completed successfully');
        } catch (error) {
            logger.error('Failed to train initial model:', error);
            throw error;
        }
    }

    async assessTransactionRisk(transaction, userProfile = null, additionalContext = {}) {
        try {
            if (!this.isModelLoaded) {
                throw new Error('Fraud detection model not loaded');
            }

            // Extract features from transaction
            const features = await this.featureExtractor.extractFeatures(
                transaction, 
                userProfile, 
                additionalContext
            );

            // Get risk score from ML model
            const riskScore = await this.predictRiskScore(features);

            // Get rule-based risk factors
            const ruleBasedRisk = await this.getRuleBasedRisk(transaction, userProfile);

            // Combine ML and rule-based scores
            const combinedScore = this.combineRiskScores(riskScore, ruleBasedRisk);

            // Determine risk level
            const riskLevel = this.determineRiskLevel(combinedScore);

            // Generate detailed risk assessment
            const assessment = {
                transactionId: transaction.id,
                riskScore: combinedScore,
                riskLevel: riskLevel,
                mlScore: riskScore,
                ruleBasedScore: ruleBasedRisk.score,
                factors: {
                    ml: features,
                    rules: ruleBasedRisk.factors
                },
                recommendations: this.generateRecommendations(riskLevel, combinedScore),
                timestamp: new Date(),
                modelVersion: await this.getModelVersion()
            };

            // Store assessment for future training
            await this.storeAssessment(assessment);

            // Log high-risk transactions
            if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
                logger.warn(`High-risk transaction detected:`, {
                    transactionId: transaction.id,
                    riskScore: combinedScore,
                    riskLevel: riskLevel
                });
            }

            return assessment;

        } catch (error) {
            logger.error('Failed to assess transaction risk:', error);
            throw error;
        }
    }

    async predictRiskScore(features) {
        try {
            const featureTensor = tf.tensor2d([features]);
            const prediction = this.model.predict(featureTensor);
            const score = await prediction.data();
            
            featureTensor.dispose();
            prediction.dispose();
            
            return score[0];
        } catch (error) {
            logger.error('Failed to predict risk score:', error);
            throw error;
        }
    }

    async getRuleBasedRisk(transaction, userProfile) {
        const factors = [];
        let score = 0;

        try {
            // Amount-based rules
            if (transaction.amount > 10000) {
                factors.push('High transaction amount');
                score += 0.3;
            }

            // Frequency rules
            const recentTransactions = await this.getRecentTransactions(
                transaction.userId, 
                24 // last 24 hours
            );
            
            if (recentTransactions.length > 10) {
                factors.push('High transaction frequency');
                score += 0.4;
            }

            // Geographic rules
            if (userProfile && await this.isUnusualLocation(transaction, userProfile)) {
                factors.push('Unusual geographic location');
                score += 0.5;
            }

            // Time-based rules
            const hour = new Date(transaction.createdAt).getHours();
            if (hour < 6 || hour > 22) {
                factors.push('Unusual transaction time');
                score += 0.2;
            }

            // Device fingerprint rules
            if (await this.isUnusualDevice(transaction, userProfile)) {
                factors.push('New or unusual device');
                score += 0.4;
            }

            // Payment method rules
            if (await this.isHighRiskPaymentMethod(transaction.paymentMethod)) {
                factors.push('High-risk payment method');
                score += 0.3;
            }

            // Velocity rules
            const velocityRisk = await this.calculateVelocityRisk(transaction);
            if (velocityRisk.score > 0.5) {
                factors.push(`High velocity: ${velocityRisk.description}`);
                score += velocityRisk.score * 0.4;
            }

            return {
                score: Math.min(score, 1.0), // Cap at 1.0
                factors: factors
            };

        } catch (error) {
            logger.error('Failed to calculate rule-based risk:', error);
            return { score: 0, factors: [] };
        }
    }

    combineRiskScores(mlScore, ruleBasedRisk) {
        // Weighted combination of ML and rule-based scores
        const mlWeight = 0.7;
        const ruleWeight = 0.3;
        
        return (mlScore * mlWeight) + (ruleBasedRisk.score * ruleWeight);
    }

    determineRiskLevel(score) {
        if (score >= this.riskThresholds.CRITICAL) return 'CRITICAL';
        if (score >= this.riskThresholds.HIGH) return 'HIGH';
        if (score >= this.riskThresholds.MEDIUM) return 'MEDIUM';
        return 'LOW';
    }

    generateRecommendations(riskLevel, score) {
        const recommendations = [];

        switch (riskLevel) {
            case 'CRITICAL':
                recommendations.push('Block transaction immediately');
                recommendations.push('Require manual review');
                recommendations.push('Notify security team');
                recommendations.push('Consider account suspension');
                break;
            
            case 'HIGH':
                recommendations.push('Hold transaction for manual review');
                recommendations.push('Require additional authentication');
                recommendations.push('Notify risk management team');
                break;
            
            case 'MEDIUM':
                recommendations.push('Apply enhanced monitoring');
                recommendations.push('Request additional verification');
                recommendations.push('Log for further analysis');
                break;
            
            case 'LOW':
                recommendations.push('Process normally');
                recommendations.push('Continue standard monitoring');
                break;
        }

        return recommendations;
    }

    async continuousLearning(feedbackData) {
        try {
            // Collect feedback on predictions for continuous learning
            const { transactionId, actualOutcome, userFeedback } = feedbackData;
            
            // Store feedback for retraining
            await this.storeFeedback({
                transactionId,
                actualOutcome, // 'fraud' or 'legitimate'
                userFeedback,
                timestamp: new Date()
            });

            // Retrain model periodically with new data
            const feedbackCount = await this.getFeedbackCount();
            if (feedbackCount >= 1000) { // Retrain every 1000 feedback points
                await this.retrainModel();
            }

        } catch (error) {
            logger.error('Failed to process feedback for continuous learning:', error);
        }
    }

    async retrainModel() {
        try {
            logger.info('Starting model retraining with new data');
            
            // Get recent transaction data including feedback
            const newTrainingData = await this.getRecentTrainingData();
            
            if (newTrainingData.length < 100) {
                logger.info('Insufficient new training data, skipping retraining');
                return;
            }

            // Prepare new training data
            const { features, labels } = await this.prepareTrainingData(newTrainingData);
            
            // Perform incremental training
            const xTensor = tf.tensor2d(features);
            const yTensor = tf.tensor2d(labels, [labels.length, 1]);

            await this.model.fit(xTensor, yTensor, {
                epochs: 10,
                batchSize: 32,
                verbose: 0
            });

            // Save updated model
            await this.model.save('file://./models/fraud-detection');
            
            // Update model version
            await this.updateModelVersion();

            // Cleanup tensors
            xTensor.dispose();
            yTensor.dispose();

            logger.info('Model retraining completed successfully');

        } catch (error) {
            logger.error('Failed to retrain model:', error);
        }
    }

    // Helper methods
    async getTrainingData() {
        // Implementation to fetch historical transaction data
        return await this.prisma.transaction.findMany({
            where: {
                createdAt: {
                    gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
                }
            },
            include: {
                user: true,
                fraudAssessment: true
            }
        });
    }

    async prepareTrainingData(rawData) {
        const features = [];
        const labels = [];

        for (const transaction of rawData) {
            try {
                const feature = await this.featureExtractor.extractFeatures(transaction);
                const label = transaction.fraudAssessment?.isFraud ? 1 : 0;
                
                features.push(feature);
                labels.push(label);
            } catch (error) {
                logger.warn(`Failed to prepare training data for transaction ${transaction.id}:`, error);
            }
        }

        return { features, labels };
    }

    async storeAssessment(assessment) {
        try {
            await this.prisma.fraudAssessment.create({
                data: {
                    transactionId: assessment.transactionId,
                    riskScore: assessment.riskScore,
                    riskLevel: assessment.riskLevel,
                    mlScore: assessment.mlScore,
                    ruleBasedScore: assessment.ruleBasedScore,
                    factors: JSON.stringify(assessment.factors),
                    recommendations: JSON.stringify(assessment.recommendations),
                    modelVersion: assessment.modelVersion
                }
            });
        } catch (error) {
            logger.error('Failed to store fraud assessment:', error);
        }
    }

    async getModelVersion() {
        return '1.0.0'; // Implement versioning logic
    }

    async updateModelVersion() {
        // Implement model version update logic
    }

    async getFeedbackCount() {
        return await this.prisma.fraudFeedback.count();
    }

    async storeFeedback(feedback) {
        await this.prisma.fraudFeedback.create({
            data: feedback
        });
    }

    async getRecentTrainingData() {
        // Get transactions with feedback for retraining
        return await this.prisma.transaction.findMany({
            where: {
                fraudFeedback: {
                    isNot: null
                }
            },
            include: {
                user: true,
                fraudFeedback: true
            }
        });
    }
}

// Feature extraction class for ML input
class FeatureExtractor {
    async extractFeatures(transaction, userProfile = null, additionalContext = {}) {
        const features = new Array(50).fill(0); // 50-dimensional feature vector
        
        try {
            // Transaction amount features
            features[0] = Math.log(transaction.amount + 1); // Log of amount
            features[1] = transaction.amount > 1000 ? 1 : 0; // Large amount flag
            features[2] = transaction.amount > 10000 ? 1 : 0; // Very large amount flag

            // Time-based features
            const hour = new Date(transaction.createdAt).getHours();
            const dayOfWeek = new Date(transaction.createdAt).getDay();
            features[3] = hour / 24; // Normalized hour
            features[4] = dayOfWeek / 7; // Normalized day of week
            features[5] = (hour < 6 || hour > 22) ? 1 : 0; // Unusual hours flag

            // User profile features (if available)
            if (userProfile) {
                features[6] = userProfile.accountAge || 0; // Days since account creation
                features[7] = userProfile.transactionCount || 0;
                features[8] = userProfile.averageTransactionAmount || 0;
                features[9] = userProfile.isVerified ? 1 : 0;
                features[10] = userProfile.riskScore || 0;
            }

            // Payment method features
            const paymentMethodRisk = this.getPaymentMethodRisk(transaction.paymentMethod);
            features[11] = paymentMethodRisk;

            // Geographic features (if available)
            if (transaction.location) {
                features[12] = transaction.location.latitude || 0;
                features[13] = transaction.location.longitude || 0;
                features[14] = await this.isHighRiskCountry(transaction.location.country) ? 1 : 0;
            }

            // Device features (if available)
            if (transaction.deviceFingerprint) {
                features[15] = transaction.deviceFingerprint.isNew ? 1 : 0;
                features[16] = transaction.deviceFingerprint.riskScore || 0;
                features[17] = transaction.deviceFingerprint.isMobile ? 1 : 0;
            }

            // Velocity features
            const velocityFeatures = await this.calculateVelocityFeatures(transaction);
            features[18] = velocityFeatures.hourlyCount;
            features[19] = velocityFeatures.dailyCount;
            features[20] = velocityFeatures.weeklyAmount;

            // Additional context features
            features[21] = additionalContext.isFirstTransaction ? 1 : 0;
            features[22] = additionalContext.hasRecentFailures ? 1 : 0;
            features[23] = additionalContext.unusualBehavior ? 1 : 0;

            // Fill remaining features with statistical measures or other relevant data
            // This is where domain expertise becomes crucial

            return features;

        } catch (error) {
            logger.error('Failed to extract features:', error);
            return features; // Return zero-filled array on error
        }
    }

    getPaymentMethodRisk(paymentMethod) {
        const riskMap = {
            'credit_card': 0.2,
            'debit_card': 0.1,
            'paypal': 0.3,
            'crypto': 0.6,
            'bank_transfer': 0.1,
            'gift_card': 0.8,
            'prepaid_card': 0.7
        };
        return riskMap[paymentMethod] || 0.5;
    }

    async isHighRiskCountry(country) {
        const highRiskCountries = ['AF', 'CF', 'IR', 'KP', 'SO', 'SY', 'YE'];
        return highRiskCountries.includes(country);
    }

    async calculateVelocityFeatures(transaction) {
        // This would typically query the database for recent transactions
        return {
            hourlyCount: 0,
            dailyCount: 0,
            weeklyAmount: 0
        };
    }
}

module.exports = { AIFraudDetectionService };