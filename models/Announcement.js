import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, 'Announcement text is required'],
    trim: true,
    maxLength: [100, 'Announcement text cannot exceed 100 characters']
  },
  url: {
    type: String,
    trim: true,
    default: '',
    validate: {
      validator: function(v) {
        if (!v) return true; // optional
        // allow http(s) or relative path starting with /
        return /^(https?:\/\/[^\s]+|\/[A-Za-z0-9_\-\/#?&=.%]+)$/.test(v);
      },
      message: 'Invalid URL format'
    }
  },
  icon: {
    type: String,
    required: [true, 'Icon name is required'],
    enum: ['Truck', 'Sparkles', 'Clock', 'CreditCard', 'Star', 'Gift', 'Heart', 'Tag'],
    default: 'Star'
  },
  // Optional uploaded icon image (takes precedence over icon enum if provided)
  iconImage: {
    type: String,
    default: '',
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        // Accept relative (optional slash) uploads path or full http(s) URL
        return /^(\/?uploads\/[^\s]+|https?:\/\/[^\s]+)$/.test(v);
      },
      message: 'iconImage must be an uploads path or full URL'
    }
  },
  description: {
    type: String,
    trim: true,
    maxLength: [160, 'Description cannot exceed 160 characters'],
    default: ''
  },
  fontSize: {
    type: String,
    enum: ['xs', 'sm', 'base', 'lg', 'xl'],
    default: 'sm'
  },
  textColor: {
    type: String,
    default: '#FFFFFF',
    validate: {
      validator: function(v) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
      },
      message: 'Invalid hex color code'
    }
  },
  backgroundColor: {
    type: String,
    default: '#4F46E5',
    validate: {
      validator: function(v) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
      },
      message: 'Invalid hex color code'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  },
  // Platform targeting: 'web', 'mobile', or 'both'
  platform: {
    type: String,
    enum: ['web', 'mobile', 'both'],
    default: 'web',
    index: true
  }
}, {
  timestamps: true
});

// Normalize iconImage path consistency
announcementSchema.pre('validate', function(next) {
  if (this.iconImage && /^uploads\//.test(this.iconImage)) {
    this.iconImage = '/' + this.iconImage;
  }
  next();
});

export default mongoose.model('Announcement', announcementSchema);