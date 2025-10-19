// src/services/removalService.js
import axios from "axios";

const API_URL = "http://localhost:4000/api/removals"; // adjust to your backend base

// ✅ Get all removals with optional filters
export const fetchRemovals = async (filters = {}) => {
  const res = await axios.get(API_URL, { params: filters });
  return res.data;
};

// ✅ Get single removal
export const fetchRemovalById = async (id) => {
  const res = await axios.get(`${API_URL}/${id}`);
  return res.data;
};

// ✅ Create new removal (this will trigger blockchain sync in backend)
export const createRemoval = async (removalData) => {
  const res = await axios.post(API_URL, removalData);
  return res.data;
};

// ✅ Delete removal
export const deleteRemoval = async (id) => {
  const res = await axios.delete(`${API_URL}/${id}`);
  return res.data;
};

// ✅ Get stats summary
export const fetchRemovalStats = async (filters = {}) => {
  const res = await axios.get(`${API_URL}/stats/summary`, { params: filters });
  return res.data;
};
