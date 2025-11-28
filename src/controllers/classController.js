const Class = require('../models/Class');
const { USER_ROLES } = require('../config/constants');

// Generate unique 10 digit Class ID
const generateClassID = () => {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

exports.addClass = async (req, res) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ message: "Only admins can create classes" });
    }

    const { className, classCode, description, year } = req.body;

    const classID = generateClassID();

    const newClass = await Class.create({
      classID,
      className,
      classCode,
      description,
      year
    });

    return res.status(201).json({
      success: true,
      class: newClass
    });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.updateClass = async (req, res) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ message: "Only admins can update classes" });
    }

    const classId = req.params.id;

    const updated = await Class.findByIdAndUpdate(classId, req.body, {
      new: true,
      runValidators: true
    });

    if (!updated) {
      return res.status(404).json({ message: "Class not found" });
    }

    return res.json({
      success: true,
      class: updated
    });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.deleteClass = async (req, res) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ message: "Only admins can delete classes" });
    }

    const deleted = await Class.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Class not found" });
    }

    return res.json({
      success: true,
      message: "Class deleted successfully"
    });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getAllClasses = async (req, res) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ message: "Only admins can view class list" });
    }

    const classes = await Class.find()
      .populate('students', 'firstName lastName rollNo')
      .populate('courses', 'courseName teacherId');

    return res.json({
      success: true,
      classes
    });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getClassDetails = async (req, res) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ message: "Only admins can view class details" });
    }

    const classData = await Class.findById(req.params.id)
      .populate('students', 'firstName lastName rollNo')
      .populate('courses', 'courseName teacherId');

    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    return res.json({
      success: true,
      class: classData
    });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
