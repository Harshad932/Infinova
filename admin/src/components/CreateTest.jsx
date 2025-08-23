import React, { useState } from "react";
import { useNavigate} from 'react-router-dom';
import {
  ArrowLeft,Plus,Trash2,Save,FileText,BookOpen,Users,
} from "lucide-react";
import styles from "../assets/styles/CreateTest.module.css";

const CreateTest = () => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    instructions: "",
    rules: "",
    timePerQuestion: 15,
  });
  const [isFormValid, setIsFormValid] = useState(false);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [activeTab, setActiveTab] = useState("basic");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const checkFormValidity = () => {
    const hasTitle = formData.title && formData.title.trim();
    const hasCategories =
      categories.length > 0 &&
      categories.every((cat) => cat.name && cat.name.trim());
    const hasSubcategories =
      subcategories.length > 0 &&
      subcategories.every(
        (sub) => sub.name && sub.name.trim() && sub.categoryId
      );
    const hasQuestions =
      questions.length > 0 &&
      questions.every(
        (q) =>
          q.questionText &&
          q.questionText.trim() &&
          q.categoryId &&
          q.subcategoryId
      );

    return hasTitle && hasCategories && hasSubcategories && hasQuestions;
  };

  React.useEffect(() => {
    setIsFormValid(checkFormValidity());
  }, [formData, categories, subcategories, questions]);

  const addCategory = () => {
    const newCategory = {
      id: Date.now(),
      name: "",
      description: "",
      displayOrder: categories.length + 1,
    };
    setCategories((prev) => [...prev, newCategory]);
  };

  const updateCategory = (id, field, value) => {
    setCategories((prev) =>
      prev.map((cat) => (cat.id === id ? { ...cat, [field]: value } : cat))
    );
  };

  const removeCategory = (id) => {
    setCategories((prev) => prev.filter((cat) => cat.id !== id));
    setSubcategories((prev) => prev.filter((sub) => sub.categoryId !== id));
    setQuestions((prev) => prev.filter((q) => q.categoryId !== id));
  };

  const addSubcategory = () => {
    if (categories.length === 0) {
      alert("Please add at least one category first");
      return;
    }
    const newSubcategory = {
      id: Date.now(),
      name: "",
      description: "",
      categoryId: categories[0].id,
      displayOrder: subcategories.length + 1,
    };
    setSubcategories((prev) => [...prev, newSubcategory]);
  };

  const updateSubcategory = (id, field, value) => {
    setSubcategories((prev) =>
      prev.map((sub) => (sub.id === id ? { ...sub, [field]: value } : sub))
    );

    // If category is changed, update related questions
    if (field === "categoryId") {
      setQuestions((prev) =>
        prev.map((q) =>
          q.subcategoryId === id
            ? { ...q, categoryId: parseInt(value), subcategoryId: "" }
            : q
        )
      );
    }
  };

  const removeSubcategory = (id) => {
    setSubcategories((prev) => prev.filter((sub) => sub.id !== id));
    setQuestions((prev) => prev.filter((q) => q.subcategoryId !== id));
  };

  const addQuestion = () => {
    if (categories.length === 0 || subcategories.length === 0) {
      alert("Please add categories and subcategories first");
      return;
    }
    const newQuestion = {
      id: Date.now(),
      questionText: "",
      categoryId: categories[0].id,
      subcategoryId: subcategories[0].id,
      options: [
        { optionText: "Strongly Agree", marks: 5 },
        { optionText: "Agree", marks: 4 },
        { optionText: "Neutral", marks: 3 },
        { optionText: "Disagree", marks: 2 },
        { optionText: "Strongly Disagree", marks: 1 },
      ],
    };
    setQuestions((prev) => [...prev, newQuestion]);
  };

  const updateQuestion = (id, field, value) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: value } : q))
    );
  };

  const removeQuestion = (id) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const validateForm = () => {
    const errors = [];

    // Validate basic info
    if (!formData.title || !formData.title.trim()) {
      errors.push("Test title is required");
    }

    // Validate categories
    if (categories.length === 0) {
      errors.push("At least one category is required");
    }

    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      if (!category.name || !category.name.trim()) {
        errors.push(`Category ${i + 1}: Category name is required`);
      }
    }

    // Validate subcategories
    if (subcategories.length === 0) {
      errors.push("At least one subcategory is required");
    }

    for (let i = 0; i < subcategories.length; i++) {
      const subcategory = subcategories[i];
      if (!subcategory.name || !subcategory.name.trim()) {
        errors.push(`Subcategory ${i + 1}: Subcategory name is required`);
      }
      if (!subcategory.categoryId) {
        errors.push(`Subcategory ${i + 1}: Category is required`);
      }
    }

    // Validate questions
    if (questions.length === 0) {
      errors.push("At least one question is required");
    }

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      if (!question.questionText || !question.questionText.trim()) {
        errors.push(`Question ${i + 1}: Question text is required`);
      }
      if (!question.categoryId) {
        errors.push(`Question ${i + 1}: Category is required`);
      }
      if (!question.subcategoryId) {
        errors.push(`Question ${i + 1}: Subcategory is required`);
      }
    }

    return errors;
  };

  const handleSave = (isDraft = false) => {
    // Prevent multiple submissions
    if (isLoading) return;

    const errors = validateForm();

    if (!isFormValid && !isDraft) {
      alert("Please fix the following errors:\n" + errors.join("\n"));
      return;
    }

    // Use 'adminToken' instead of 'token' to match your working code
    const token = localStorage.getItem("adminToken");
    if (!token) {
      alert("Authentication token not found. Please login again.");
      return;
    }

    setIsLoading(true);

    // Use the same data structure as your working code
    const testPayload = {
      title: formData.title,
      description: formData.description,
      instructions: formData.instructions,
      rules: formData.rules,
      timePerQuestion: formData.timePerQuestion,
      totalQuestions: questions.length,
      isPublished: !isDraft,
      categories,
      subcategories,
      questions,
      isDraft,
    };

    // Use environment variable for backend URL like your working code
    fetch(
      `${process.env.REACT_APP_BACKEND_URL}/api/admin/create-test`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(testPayload),
      }
    )
      .then(response => {
        return response.json().then(result => {
          if (response.ok) {
            alert(result.message);
            navigate("/admin/manage-tests");
            
          } else {
            // Handle different error status codes
            if (response.status === 401) {
              alert("Authentication failed. Please login again.");
            } else if (response.status === 403) {
              alert("Access denied. Admin privileges required.");
            } else {
              alert("Error: " + result.message);
            }
            console.error("Server error:", result);
          }
        });
      })
      .catch(error => {
        console.error("Network error saving test:", error);

        // Handle different types of network errors
        if (error.name === "TypeError" && error.message.includes("fetch")) {
          alert(
            "Network error: Unable to connect to server. Please check if the server is running."
          );
        } else {
          alert("Error saving test. Please try again.");
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const TabButton = ({ id, label, count, active, onClick }) => (
    <button
      onClick={onClick}
      className={`${styles["tab-button"]} ${active ? styles["tab-button-active"] : ""}`}
    >
      {label} {count !== "" ? `(${count})` : ""}
    </button>
  );

  return (
    <div className={styles["CreateTest-container"]}>
      {/* Header */}
      <div className={styles["header"]}>
        <div className={styles["header-content"]}>
          <div className={styles["header-left"]}>
            <button
              className={styles["back-button"]}
              onClick={() => window.history.back()}
            >
              <ArrowLeft size={20} />
              <span>Back to Dashboard</span>
            </button>
          </div>
          <div className={styles["header-right"]}>
            <button
              onClick={() => handleSave(true)}
              className={`${styles["save-draft-button"]} ${isFormValid ? styles["valid"] : styles["invalid"]}`}
              disabled={isLoading}
            >
              <Save size={16} />
              <span>{isLoading ? "Saving..." : "Save Draft"}</span>
            </button>
          </div>
        </div>
      </div>

      <div className={styles["main-content"]}>
        {/* Title */}
        <div className={styles["title-section"]}>
          <h1 className={styles["main-title"]}>Create New Test</h1>
          <p className={styles["main-subtitle"]}>
            Build comprehensive assessments with categories, subcategories, and
            questions
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className={styles["tabs-container"]}>
          <TabButton
            id="basic"
            label="Basic Info"
            count=""
            active={activeTab === "basic"}
            onClick={() => setActiveTab("basic")}
          />
          <TabButton
            id="categories"
            label="Categories"
            count={categories.length}
            active={activeTab === "categories"}
            onClick={() => setActiveTab("categories")}
          />
          <TabButton
            id="subcategories"
            label="Subcategories"
            count={subcategories.length}
            active={activeTab === "subcategories"}
            onClick={() => setActiveTab("subcategories")}
          />
          <TabButton
            id="questions"
            label="Questions"
            count={questions.length}
            active={activeTab === "questions"}
            onClick={() => setActiveTab("questions")}
          />
        </div>

        {/* Content Area */}
        <div className={styles["content-area"]}>
          {/* Basic Info Tab */}
          {activeTab === "basic" && (
            <div className={`${styles["tab-content"]} ${styles["basic-info-tab"]}`}>
              <div className={styles["form-grid"]}>
                <div className={styles["form-field"]}>
                  <label className={styles["form-label"]}>
                    Test Title <span className={styles["required"]}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter test title..."
                    value={formData.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    className={styles["form-input"]}
                  />
                </div>

                <div className={styles["form-field"]}>
                  <label className={styles["form-label"]}>
                    Time per Question (seconds)
                  </label>
                  <select
                    value={formData.timePerQuestion}
                    onChange={(e) =>
                      handleInputChange(
                        "timePerQuestion",
                        parseInt(e.target.value)
                      )
                    }
                    className={styles["form-select"]}
                  >
                    <option value={15}>15 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={60}>60 seconds</option>
                    <option value={120}>2 minutes</option>
                  </select>
                </div>
              </div>

              <div className={styles["form-field"]}>
                <label className={styles["form-label"]}>Test Description</label>
                <textarea
                  placeholder="Enter test description..."
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  rows={4}
                  className={styles["form-textarea"]}
                />
              </div>

              <div className={styles["form-field"]}>
                <label className={styles["form-label"]}>Instructions</label>
                <textarea
                  placeholder="Enter test instructions..."
                  value={formData.instructions}
                  onChange={(e) =>
                    handleInputChange("instructions", e.target.value)
                  }
                  rows={4}
                  className={styles["form-textarea"]}
                />
              </div>

              <div className={styles["form-field"]}>
                <label className={styles["form-label"]}>Rules</label>
                <textarea
                  placeholder="Enter test rules..."
                  value={formData.rules}
                  onChange={(e) => handleInputChange("rules", e.target.value)}
                  rows={4}
                  className={styles["form-textarea"]}
                />
              </div>

              <div className={styles["summary-card"]}>
                <div className={styles["summary-header"]}>
                  <FileText size={20} />
                  <span>Total Questions</span>
                </div>
                <p className={styles["summary-count"]}>
                  {questions.length} questions added
                </p>
              </div>
            </div>
          )}

          {/* Categories Tab */}
          {activeTab === "categories" && (
            <div className={styles["tab-content"]}>
              <div className={styles["section-header"]}>
                <h2 className={styles["section-title"]}>
                  <BookOpen size={24} />
                  <span>Categories</span>
                </h2>
                <button onClick={addCategory} className={styles["add-button"]}>
                  <Plus size={16} />
                  <span>Add Category</span>
                </button>
              </div>

              {categories.length === 0 ? (
                <div className={styles["empty-state"]}>
                  <BookOpen size={48} />
                  <p>
                    No categories added yet. Click "Add Category" to get
                    started.
                  </p>
                </div>
              ) : (
                <div className={styles["items-list"]}>
                  {categories.map((category, index) => (
                    <div key={category.id} className={styles["item-card"]}>
                      <div className={styles["item-header"]}>
                        <h3 className={`${styles["item-title"]} ${styles["category-title"]}`}>
                          Category {index + 1}
                        </h3>
                        <button
                          onClick={() => removeCategory(category.id)}
                          className={styles["delete-button"]}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className={styles["item-form-grid"]}>
                        <div className={styles["form-field"]}>
                          <label className={styles["form-label"]}>
                            Category Name <span className={styles["required"]}>*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Enter category name..."
                            value={category.name}
                            onChange={(e) =>
                              updateCategory(
                                category.id,
                                "name",
                                e.target.value
                              )
                            }
                            className={styles["form-input"]}
                          />
                        </div>

                        <div className={styles["form-field"]}>
                          <label className={styles["form-label"]}>Description</label>
                          <input
                            type="text"
                            placeholder="Enter description..."
                            value={category.description}
                            onChange={(e) =>
                              updateCategory(
                                category.id,
                                "description",
                                e.target.value
                              )
                            }
                            className={styles["form-input"]}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Subcategories Tab */}
          {activeTab === "subcategories" && (
            <div className={styles["tab-content"]}>
              <div className={styles["section-header"]}>
                <h2 className={styles["section-title"]}>
                  <Users size={24} />
                  <span>Subcategories</span>
                </h2>
                <button
                  onClick={addSubcategory}
                  disabled={categories.length === 0}
                  className={`${styles["add-button"]} ${
                    categories.length === 0 ? styles["disabled"] : ""
                  }`}
                >
                  <Plus size={16} />
                  <span>Add Subcategory</span>
                </button>
              </div>

              {subcategories.length === 0 ? (
                <div className={styles["empty-state"]}>
                  <Users size={48} />
                  <p>
                    No subcategories added yet.{" "}
                    {categories.length === 0
                      ? "Add categories first, then"
                      : 'Click "Add Subcategory" to'}{" "}
                    get started.
                  </p>
                </div>
              ) : (
                <div className={styles["items-list"]}>
                  {subcategories.map((subcategory, index) => (
                    <div key={subcategory.id} className={styles["item-card"]}>
                      <div className={styles["item-header"]}>
                        <h3 className={`${styles["item-title"]} ${styles["subcategory-title"]}`}>
                          Subcategory {index + 1}
                        </h3>
                        <button
                          onClick={() => removeSubcategory(subcategory.id)}
                          className={styles["delete-button"]}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className={`${styles["item-form-grid"]} ${styles["three-cols"]}`}>
                        <div className={styles["form-field"]}>
                          <label className={styles["form-label"]}>
                            Subcategory Name <span className={styles["required"]}>*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Enter subcategory name..."
                            value={subcategory.name}
                            onChange={(e) =>
                              updateSubcategory(
                                subcategory.id,
                                "name",
                                e.target.value
                              )
                            }
                            className={styles["form-input"]}
                          />
                        </div>

                        <div className={styles["form-field"]}>
                          <label className={styles["form-label"]}>
                            Parent Category <span className={styles["required"]}>*</span>
                          </label>
                          <select
                            value={subcategory.categoryId}
                            onChange={(e) =>
                              updateSubcategory(
                                subcategory.id,
                                "categoryId",
                                parseInt(e.target.value)
                              )
                            }
                            className={styles["form-select"]}
                          >
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name ||
                                  `Category ${
                                    categories.indexOf(category) + 1
                                  }`}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className={styles["form-field"]}>
                          <label className={styles["form-label"]}>Description</label>
                          <input
                            type="text"
                            placeholder="Enter description..."
                            value={subcategory.description}
                            onChange={(e) =>
                              updateSubcategory(
                                subcategory.id,
                                "description",
                                e.target.value
                              )
                            }
                            className={styles["form-input"]}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Questions Tab */}
          {activeTab === "questions" && (
            <div className={styles["tab-content"]}>
              <div className={styles["section-header"]}>
                <h2 className={styles["section-title"]}>
                  <FileText size={24} />
                  <span>Questions</span>
                </h2>
                <button
                  onClick={addQuestion}
                  disabled={
                    categories.length === 0 || subcategories.length === 0
                  }
                  className={`${styles["add-button"]} ${
                    categories.length === 0 || subcategories.length === 0
                      ? styles["disabled"]
                      : ""
                  }`}
                >
                  <Plus size={16} />
                  <span>Add Question</span>
                </button>
              </div>

              {questions.length === 0 ? (
                <div className={styles["empty-state"]}>
                  <FileText size={48} />
                  <p>
                    No questions added yet. Add categories and subcategories
                    first, then click "Add Question" to get started.
                  </p>
                </div>
              ) : (
                <div className={styles["items-list"]}>
                  {questions.map((question, index) => (
                    <div key={question.id} className={`${styles["item-card"]} ${styles["question-card"]}`}>
                      <div className={styles["item-header"]}>
                        <h3 className={`${styles["item-title"]} ${styles["question-title"]}`}>
                          Question {index + 1}
                        </h3>
                        <button
                          onClick={() => removeQuestion(question.id)}
                          className={styles["delete-button"]}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className={styles["question-form"]}>
                        <div className={styles["form-field"]}>
                          <label className={styles["form-label"]}>
                            Question Text <span className={styles["required"]}>*</span>
                          </label>
                          <textarea
                            placeholder="Enter your question..."
                            value={question.questionText}
                            onChange={(e) =>
                              updateQuestion(
                                question.id,
                                "questionText",
                                e.target.value
                              )
                            }
                            rows={3}
                            className={styles["form-textarea"]}
                          />
                        </div>

                        <div className={styles["question-selects"]}>
                          <div className={styles["form-field"]}>
                            <label className={styles["form-label"]}>
                              Category <span className={styles["required"]}>*</span>
                            </label>
                            <select
                              value={question.categoryId}
                              onChange={(e) =>
                                updateQuestion(
                                  question.id,
                                  "categoryId",
                                  parseInt(e.target.value)
                                )
                              }
                              className={styles["form-select"]}
                            >
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name ||
                                    `Category ${
                                      categories.indexOf(category) + 1
                                    }`}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className={styles["form-field"]}>
                            <label className={styles["form-label"]}>
                              Subcategory <span className={styles["required"]}>*</span>
                            </label>
                            <select
                              value={question.subcategoryId}
                              onChange={(e) =>
                                updateQuestion(
                                  question.id,
                                  "subcategoryId",
                                  parseInt(e.target.value)
                                )
                              }
                              className={styles["form-select"]}
                            >
                              <option value="">Select subcategory...</option>
                              {subcategories
                                .filter(
                                  (sub) =>
                                    sub.categoryId === question.categoryId
                                )
                                .map((subcategory) => (
                                  <option
                                    key={subcategory.id}
                                    value={subcategory.id}
                                  >
                                    {subcategory.name ||
                                      `Subcategory ${
                                        subcategories.indexOf(subcategory) + 1
                                      }`}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>

                        <div className={styles["form-field"]}>
                          <label className={styles["form-label"]}>
                            Response Options (Fixed Scale)
                          </label>
                          <div className={styles["options-grid"]}>
                            {question.options.map((option, optIndex) => (
                              <div key={optIndex} className={styles["option-card"]}>
                                <span className={styles["option-text"]}>
                                  {option.optionText}
                                </span>
                                <span className={styles["option-points"]}>
                                  {option.marks}{" "}
                                  {option.marks === 1 ? "point" : "points"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateTest;