const express = require('express');
const router = express.Router();
const axios = require('axios');

// رابط سيرفر الـ AI الخاص بك على منصة Modal
const MODAL_AI_URL = 'https://abdoabdotarek7523--el-mostawsaf-run-app.modal.run';

// 1. مسار الشات والمحادثة الطبية
router.post('/chat', async (req, res, next) => {
  try {
    const response = await axios.post(`${MODAL_AI_URL}/api/chat`, req.body);
    return res.status(response.status).json(response.data);
  } catch (error) {
    next(error);
  }
});

// 2. مسار مسح ذاكرة الشات
router.post('/clear-memory', async (req, res, next) => {
  try {
    const response = await axios.post(`${MODAL_AI_URL}/api/clear-memory`, req.body);
    return res.status(response.status).json(response.data);
  } catch (error) {
    next(error);
  }
});

// 3. مسار تحليل الصور والأشعة (Vision)
router.post('/vision/analyze', async (req, res, next) => {
  try {
    const response = await axios.post(`${MODAL_AI_URL}/api/vision/analyze`, req.body);
    return res.status(response.status).json(response.data);
  } catch (error) {
    next(error);
  }
});

// 4. مسار استقبال وتحليل قراءات الساعة الطبية (Wearable)
router.post('/wearable/data', async (req, res, next) => {
  try {
    const response = await axios.post(`${MODAL_AI_URL}/api/wearable/data`, req.body);
    return res.status(response.status).json(response.data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;