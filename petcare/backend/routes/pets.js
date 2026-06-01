const express = require('express');
const router = express.Router();
const {
  getPets,
  getPet,
  createPet,
  updatePet,
  deletePet,
  getDietRecords,
  createDietRecord,
  updateDietRecord,
  deleteDietRecord,
  getBehaviorRecords,
  createBehaviorRecord,
  updateBehaviorRecord,
  deleteBehaviorRecord,
  getWeightRecords,
  createWeightRecord,
  updateWeightRecord,
  deleteWeightRecord,
  getVaccineRecords,
  createVaccineRecord,
  updateVaccineRecord,
  deleteVaccineRecord,
  getMedicalRecords,
  createMedicalRecord,
  updateMedicalRecord,
  deleteMedicalRecord
} = require('../controllers/petController');
const {
  getAiAnalyses,
  createAiAnalysis,
  getNutritionPlan,
  getMonthlyReport
} = require('../controllers/insightController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, getPets);
router.post('/', authenticateToken, createPet);

router.get('/:petId/diet', authenticateToken, getDietRecords);
router.post('/:petId/diet', authenticateToken, createDietRecord);
router.put('/:petId/diet/:recordId', authenticateToken, updateDietRecord);
router.delete('/:petId/diet/:recordId', authenticateToken, deleteDietRecord);

router.get('/:petId/behavior', authenticateToken, getBehaviorRecords);
router.post('/:petId/behavior', authenticateToken, createBehaviorRecord);
router.put('/:petId/behavior/:recordId', authenticateToken, updateBehaviorRecord);
router.delete('/:petId/behavior/:recordId', authenticateToken, deleteBehaviorRecord);

router.get('/:petId/weight', authenticateToken, getWeightRecords);
router.post('/:petId/weight', authenticateToken, createWeightRecord);
router.put('/:petId/weight/:recordId', authenticateToken, updateWeightRecord);
router.delete('/:petId/weight/:recordId', authenticateToken, deleteWeightRecord);

router.get('/:petId/vaccine', authenticateToken, getVaccineRecords);
router.post('/:petId/vaccine', authenticateToken, createVaccineRecord);
router.put('/:petId/vaccine/:recordId', authenticateToken, updateVaccineRecord);
router.delete('/:petId/vaccine/:recordId', authenticateToken, deleteVaccineRecord);

router.get('/:petId/medical', authenticateToken, getMedicalRecords);
router.post('/:petId/medical', authenticateToken, createMedicalRecord);
router.put('/:petId/medical/:recordId', authenticateToken, updateMedicalRecord);
router.delete('/:petId/medical/:recordId', authenticateToken, deleteMedicalRecord);
router.get('/:petId/ai-analysis', authenticateToken, getAiAnalyses);
router.post('/:petId/ai-analysis', authenticateToken, createAiAnalysis);
router.get('/:petId/nutrition-plan', authenticateToken, getNutritionPlan);
router.get('/:petId/monthly-report', authenticateToken, getMonthlyReport);

router.get('/:petId', authenticateToken, getPet);
router.put('/:petId', authenticateToken, updatePet);
router.delete('/:petId', authenticateToken, deletePet);

module.exports = router;
