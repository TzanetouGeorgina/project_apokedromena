/**
 Κεντρικό axios instance για όλο το frontend
 baseURL ορίζεται από VITE_API_BASE_URL (.env)
 έτσι αν αλλάξει backend URL, το αλλάζουμε σε ένα σημείο
 */
import axios from "axios";

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});
