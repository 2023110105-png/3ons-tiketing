// Input Validation Utilities

export const validators = {
  // Check if value is not empty
  required: (value, fieldName = 'Field') => {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return `${fieldName} is required`;
    }
    return null;
  },
  
  // Validate UUID format
  uuid: (value, fieldName = 'ID') => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!value || !uuidRegex.test(value)) {
      return `${fieldName} must be a valid UUID`;
    }
    return null;
  },
  
  // Validate phone number (Indonesia)
  phone: (value) => {
    if (!value) return null; // Optional
    const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
    if (!phoneRegex.test(value.replace(/\s/g, ''))) {
      return 'Phone number format is invalid';
    }
    return null;
  },
  
  // Validate email
  email: (value) => {
    if (!value) return null; // Optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Email format is invalid';
    }
    return null;
  },
  
  // Validate ticket ID format
  ticketId: (value) => {
    if (!value || value.trim().length < 3) {
      return 'Ticket ID must be at least 3 characters';
    }
    return null;
  },
  
  // Validate day number
  day: (value) => {
    const dayNum = parseInt(value, 10);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 5) {
      return 'Day must be between 1 and 5';
    }
    return null;
  },
  
  // Validate category - accepts any custom category
  category: (value) => {
    if (!value || typeof value !== 'string' || value.trim() === '') {
      return 'Category is required';
    }
    if (value.trim().length > 50) {
      return 'Category must not exceed 50 characters';
    }
    return null;
  }
};

// Validate object against schema
export function validateObject(data, schema) {
  const errors = {};
  
  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    
    for (const rule of rules) {
      let error = null;
      
      if (typeof rule === 'function') {
        error = rule(value, field);
      } else if (typeof rule === 'string') {
        // Predefined validator
        const validatorFn = validators[rule];
        if (validatorFn) {
          error = validatorFn(value, field);
        }
      } else if (rule.validator && typeof rule.validator === 'function') {
        error = rule.validator(value, field);
        if (error && rule.message) {
          error = rule.message;
        }
      }
      
      if (error) {
        errors[field] = error;
        break; // Stop at first error for this field
      }
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// Common validation schemas
export const schemas = {
  participant: {
    ticket_id: ['required', 'ticketId'],
    name: ['required'],
    phone: ['phone'],
    email: ['email'],
    category: ['category'],
    day: ['day']
  },
  
  checkIn: {
    ticket_id: ['required', 'ticketId'],
    gate_id: ['required'],
    day: ['day']
  },
  
  tenant: {
    name: ['required'],
    slug: ['required']
  }
};

// Sanitize input
export function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, ''); // Basic XSS prevention
}

export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return {};
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export default {
  validators,
  validateObject,
  schemas,
  sanitizeString,
  sanitizeObject
};
