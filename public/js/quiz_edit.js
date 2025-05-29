async function updateQuiz() {
    try {
        const formData = new FormData();
        
        // Collect quiz info
        const quizInfo = {
            title: document.getElementById('quizTitle').value.trim(),
            mode: document.getElementById('quizMode').value,
            language: document.getElementById('quizLanguage').value
        };

        if (quizInfo.mode === 'offline') {
            quizInfo.scheduleSettings = {
                startTime: document.getElementById('startTime').value,
                endTime: document.getElementById('endTime').value
            };
        }

        // Collect questions data
        const questionsData = [];
        document.querySelectorAll('.question-card').forEach((card, index) => {
            const questionNum = index + 1;
            const questionData = {
                number: questionNum,
                content: card.querySelector(`#question${questionNum}Content`).value.trim(),
                type: card.querySelector(`#question${questionNum}Type`).value
            };

            // Handle image file
            const imageFile = card.querySelector(`#question${questionNum}Image`).files[0];
            const existingImage = card.querySelector('.image-preview img');
            if (imageFile) {
                formData.append(`questionImage_${questionNum}`, imageFile);
            } else if (existingImage) {
                questionData.image = existingImage.src;
            }

            // Handle options and answers
            if (questionData.type === 'multiple_choice') {
                questionData.options = ['A', 'B', 'C', 'D'].map(letter => ({
                    letter,
                    text: card.querySelector(`#question${questionNum}Option${letter}`).value.trim()
                })).filter(opt => opt.text);

                questionData.correctAnswer = Array.from(
                    card.querySelectorAll(`input[name="correctAnswer${questionNum}"]:checked`)
                ).map(cb => cb.value);
            } else {
                const textAnswer = card.querySelector(`#question${questionNum}TextAnswer`).value;
                questionData.correctAnswer = textAnswer.split(',').map(ans => ans.trim()).filter(ans => ans);
            }

            questionsData.push(questionData);
        });

        formData.append('quizInfo', JSON.stringify(quizInfo));
        formData.append('questionsData', JSON.stringify(questionsData));

        // Show loading state
        const submitButton = document.querySelector('.btn-light');
        const originalText = submitButton.innerHTML;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
        submitButton.disabled = true;

        const response = await fetch(`/quizzes/${quizId}`, {
            method: 'PUT',
            body: formData
        });

        if (!response.ok) throw new Error('Failed to update quiz');

        Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: 'Quiz updated successfully',
            timer: 2000,
            showConfirmButton: false
        }).then(() => {
            window.location.href = '/quizzes';
        });

    } catch (error) {
        console.error('Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error!',
            text: error.message || 'Failed to update quiz'
        });
    }
}

let questionCount = 0; // Will be set from template
let previewTimer;

document.addEventListener('DOMContentLoaded', function() {
    // Initialize question count from existing questions
    const questions = document.querySelectorAll('.question-card');
    questionCount = questions.length;
});

function addQuestion() {
    questionCount++;
    const questionHTML = generateQuestionHTML(questionCount);
    document.getElementById('questionsContainer').insertAdjacentHTML('beforeend', questionHTML);
}

function generateQuestionHTML(num) {
    return `
        <div class="card question-card" id="question${num}">
            <div class="card-header d-flex align-items-center">
                <div class="d-flex align-items-center">
                    <div class="question-number me-3">${num}</div>
                    <h5 class="mb-0">Question ${num}</h5>
                </div>
                <div class="question-actions">
                    <div class="btn-group-vertical action-buttons">
                        <button type="button" class="btn btn-outline-secondary btn-sm" 
                                onclick="moveQuestion(${num}, 'up')" 
                                title="Move Up">
                            <i class="fas fa-arrow-up"></i>
                        </button>
                        <button type="button" class="btn btn-outline-secondary btn-sm" 
                                onclick="moveQuestion(${num}, 'down')" 
                                title="Move Down">
                            <i class="fas fa-arrow-down"></i>
                        </button>
                        <button type="button" class="btn btn-outline-secondary btn-sm" 
                                onclick="translateContent(${num})" 
                                title="Translate">
                            <i class="fas fa-language"></i>
                        </button>
                        <button type="button" class="btn btn-outline-secondary btn-sm" 
                                onclick="deleteQuestion(${num})" 
                                title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-8">
                        <div class="mb-3">
                            <label for="question${num}Content" class="form-label fw-semibold">Question Content *</label>
                            <textarea class="form-control" id="question${num}Content" rows="3" placeholder="Enter your question here..."></textarea>
                        </div>
                        
                        <div class="mb-3">
                            <label for="question${num}Type" class="form-label fw-semibold">Question Type *</label>
                            <select class="form-select" id="question${num}Type" onchange="toggleAnswerOptions(${num})">
                                <option value="multiple_choice">Multiple Choice A/B/C/D</option>
                                <option value="text_input">Text Input</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="col-md-4">
                        <div class="mb-3">
                            <label for="question${num}Image" class="form-label fw-semibold">Question Image</label>
                            <input type="file" class="form-control" id="question${num}Image" accept="image/*" onchange="previewImage(${num})">
                        </div>
                        <div id="imagePreview${num}" class="image-preview">
                            <i class="fas fa-image fa-2x text-muted mb-2"></i>
                            <div class="text-muted small">Image preview will appear here</div>
                        </div>
                    </div>
                </div>
                
                <div id="answerOptions${num}">
                    <h6 class="text-primary mb-3">Answer Options</h6>
                    <div class="row g-3">
                        <div class="col-md-6">
                            <div class="input-group">
                                <span class="input-group-text">
                                    <input type="radio" name="correctAnswer${num}" value="A" class="form-check-input">
                                </span>
                                <span class="input-group-text fw-bold">A</span>
                                <input type="text" class="form-control" placeholder="Option A" id="question${num}OptionA">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="input-group">
                                <span class="input-group-text">
                                    <input type="radio" name="correctAnswer${num}" value="B" class="form-check-input">
                                </span>
                                <span class="input-group-text fw-bold">B</span>
                                <input type="text" class="form-control" placeholder="Option B" id="question${num}OptionB">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="input-group">
                                <span class="input-group-text">
                                    <input type="radio" name="correctAnswer${num}" value="C" class="form-check-input">
                                </span>
                                <span class="input-group-text fw-bold">C</span>
                                <input type="text" class="form-control" placeholder="Option C" id="question${num}OptionC">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="input-group">
                                <span class="input-group-text">
                                    <input type="radio" name="correctAnswer${num}" value="D" class="form-check-input">
                                </span>
                                <span class="input-group-text fw-bold">D</span>
                                <input type="text" class="form-control" placeholder="Option D" id="question${num}OptionD">
                            </div>
                        </div>
                    </div>
                    <div class="mt-2">
                        <small class="text-muted">
                            <i class="fas fa-info-circle me-1"></i>Select the radio button next to the correct answer
                        </small>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function toggleDateTimeSection() {
    const mode = document.getElementById('quizMode').value;
    const dateTimeSection = document.getElementById('dateTimeSection');
    
    if (mode === 'offline') {
        dateTimeSection.style.display = 'block';
    } else {
        dateTimeSection.style.display = 'none';
    }
}

function toggleAnswerOptions(questionNum) {
    const questionType = document.getElementById(`question${questionNum}Type`).value;
    const answerOptions = document.getElementById(`answerOptions${questionNum}`);
    
    if (questionType === 'text_input') {
        answerOptions.style.display = 'none';
    } else {
        answerOptions.style.display = 'block';
    }
}

function previewImage(questionNum) {
    const fileInput = document.getElementById(`question${questionNum}Image`);
    const preview = document.getElementById(`imagePreview${questionNum}`);
    
    // Nếu không có file được chọn, giữ nguyên preview hiện tại
    if (!fileInput.files || fileInput.files.length === 0) {
        return;
    }
    
    const file = fileInput.files[0];
    
    // Kiểm tra file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        fileInput.value = ''; // Reset input
        return;
    }

    // Thêm preview và nút xóa
    const reader = new FileReader();
    reader.onload = function(e) {
        preview.innerHTML = `
            <div class="position-relative">
                <img src="${e.target.result}" alt="Preview" class="mb-2">
                <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0" 
                        onclick="deleteImage(${questionNum})">
                    <i class="fas fa-times"></i>
                </button>
            </div>`;
    };
    reader.readAsDataURL(file);
}

function deleteImage(questionNum) {
    // if (confirm('Are you sure you want to delete this image?')) {
        // Reset file input
        const fileInput = document.getElementById(`question${questionNum}Image`);
        fileInput.value = '';
        
        // Reset preview
        const preview = document.getElementById(`imagePreview${questionNum}`);
        preview.innerHTML = `
            <i class="fas fa-image fa-2x text-muted mb-2"></i>
            <div class="text-muted small">Image preview will appear here</div>`;
    // }
}

function translateContent(questionNum) {
    // Mock translate function - in real implementation would call translation API
    alert(`Translation feature for question ${questionNum} would be implemented here`);
}

function previewQuiz() {
    // Clear previous preview content
    document.getElementById('previewQuestionsContainer').innerHTML = '';
    document.getElementById('previewNavigator').innerHTML = '';
    
    // Set quiz info
    document.getElementById('previewTitle').textContent = document.getElementById('quizTitle').value || 'Untitled Quiz';
    document.getElementById('previewMode').textContent = document.getElementById('quizMode').value.charAt(0).toUpperCase() + 
        document.getElementById('quizMode').value.slice(1);
    document.getElementById('previewLanguage').textContent = document.getElementById('quizLanguage').value.charAt(0).toUpperCase() + 
        document.getElementById('quizLanguage').value.slice(1);

    // Set schedule if offline mode
    const scheduleEl = document.getElementById('previewSchedule');
    if (document.getElementById('quizMode').value === 'offline') {
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        if (startTime && endTime) {
            scheduleEl.innerHTML = `
                <i class="fas fa-clock me-1"></i>
                <span>${new Date(startTime).toLocaleString()} - ${new Date(endTime).toLocaleString()}</span>
            `;
        }
    } else {
        scheduleEl.innerHTML = '';
    }

    // Generate questions preview
    const questions = document.querySelectorAll('#questionsContainer .question-card');
    const previewContainer = document.getElementById('previewQuestionsContainer');
    const navigator = document.getElementById('previewNavigator');
    
    questions.forEach((question, index) => {
        // Create question preview
        const content = question.querySelector('textarea[id^="question"]').value;
        const type = question.querySelector('select[id^="question"]').value;
        const imagePreview = question.querySelector('.image-preview img');
        
        let questionHTML = `
            <div class="preview-question p-4 mb-4" id="previewQuestion${index + 1}">
                <div class="d-flex align-items-start">
                    <div class="question-counter me-3">${index + 1}</div>
                    <div class="flex-grow-1">
                        <h5 class="mb-3">${content}</h5>`;
        
        // Add image if exists
        if (imagePreview) {
            questionHTML += `
                <div class="mb-3 text-center">
                    <img src="${imagePreview.src}" alt="Question Image" class="img-fluid rounded" style="max-height: 300px;">
                </div>`;
        }
        
        // Add answer options
        if (type === 'multiple_choice') {
            questionHTML += '<div class="preview-options">';
            ['A', 'B', 'C', 'D'].forEach(letter => {
                const optionText = question.querySelector(`#question${index + 1}Option${letter}`).value;
                if (optionText) {
                    questionHTML += `
                        <div class="preview-option" onclick="selectPreviewOption(this, ${index + 1})">
                            <div class="d-flex align-items-center">
                                <div class="option-indicator me-3">${letter}</div>
                                <div class="flex-grow-1">${optionText}</div>
                            </div>
                        </div>`;
                }
            });
            questionHTML += '</div>';
        } else {
            questionHTML += `
                <div class="mt-3">
                    <textarea class="form-control" rows="3" placeholder="Type your answer here..."></textarea>
                </div>`;
        }
        
        questionHTML += `
                    </div>
                </div>
            </div>`;
        
        previewContainer.innerHTML += questionHTML;
        
        // Add navigator button
        navigator.innerHTML += `
            <button class="btn btn-outline-primary" onclick="scrollToPreviewQuestion(${index + 1})">
                ${index + 1}
            </button>`;
    });

    // Start mock timer
    startMockTimer();
}

function scrollToPreviewQuestion(num) {
    document.getElementById(`previewQuestion${num}`).scrollIntoView({
        behavior: 'smooth',
        block: 'center'
    });
}

function selectPreviewOption(element, questionNum) {
    const parent = element.closest('.preview-options');
    parent.querySelectorAll('.preview-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    element.classList.add('selected');
    updatePreviewProgress();
}

function updatePreviewProgress() {
    const total = document.querySelectorAll('.preview-question').length;
    const answered = document.querySelectorAll('.preview-option.selected').length;
    const progress = (answered / total) * 100;
    
    const progressBar = document.getElementById('previewProgress');
    progressBar.style.width = `${progress}%`;
    progressBar.setAttribute('aria-valuenow', progress);
}

function startMockTimer() {
    if (previewTimer) clearInterval(previewTimer);
    
    let time = 45 * 60; // 45 minutes
    const timerEl = document.getElementById('previewTimer');
    
    previewTimer = setInterval(() => {
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        
        timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (--time < 0) {
            clearInterval(previewTimer);
            timerEl.textContent = '00:00';
        }
    }, 1000);
}

// Reset timer when modal is closed
document.getElementById('previewModal').addEventListener('hidden.bs.modal', function () {
    if (previewTimer) clearInterval(previewTimer);
});

function editQuiz() {
    // Close the preview modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('previewModal'));
    modal.hide();
    
    // Scroll back to the top of the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function submitQuiz() {
    // Validate required fields
    const title = document.getElementById('quizTitle').value.trim();
    if (!title) {
        alert('Please enter a quiz title');
        return;
    }

    // Collect quiz basic information
    const quizData = {
        title: title,
        mode: document.getElementById('quizMode').value,
        language: document.getElementById('quizLanguage').value,
        scheduleSettings: null,
        questions: []
    };

    // Add schedule settings if mode is offline
    if (quizData.mode === 'offline') {
        quizData.scheduleSettings = {
            startTime: document.getElementById('startTime').value,
            endTime: document.getElementById('endTime').value
        };
    }

    // Collect questions data vào một mảng
    const questionsData = [];
    const questions = document.querySelectorAll('#questionsContainer .card');
    
    questions.forEach((questionCard, index) => {
        const questionContent = questionCard.querySelector(`textarea[id$="Content"]`);
        const questionType = questionCard.querySelector(`select[id$="Type"]`);
        
        if (questionContent && questionContent.value.trim()) {
            const questionData = {
                number: index + 1,
                content: questionContent.value.trim(),
                type: questionType.value,
                options: [],
                correctAnswer: null
            };

            // Get options and correct answer for multiple choice
            if (questionType.value === 'multiple_choice') {
                const correctRadio = document.querySelector(`input[name="correctAnswer${index + 1}"]:checked`);
                if (correctRadio) {
                    questionData.correctAnswer = correctRadio.value;
                }

                ['A', 'B', 'C', 'D'].forEach(letter => {
                    const optionInput = questionCard.querySelector(`input[id$="Option${letter}"]`);
                    if (optionInput && optionInput.value.trim()) {
                        questionData.options.push({
                            letter: letter,
                            text: optionInput.value.trim()
                        });
                    }
                });

                // Validate multiple choice
                if (questionData.options.length < 2) {
                    alert(`Question ${index + 1} must have at least 2 options`);
                    return;
                }
                if (!questionData.correctAnswer) {
                    alert(`Please select correct answer for question ${index + 1}`);
                    return;
                }
            }

            questionsData.push(questionData);
        }
    });

    // Validate questions array
    if (questionsData.length === 0) {
        alert('Please add at least one question');
        return;
    }

    // Create FormData
    const formData = new FormData();
    
    // Add quiz basic info
    formData.append('quizInfo', JSON.stringify({
        title: quizData.title,
        mode: quizData.mode,
        language: quizData.language,
        scheduleSettings: quizData.scheduleSettings
    }));

    // Add questions array as JSON
    formData.append('questionsData', JSON.stringify(questionsData));

    // Add image files separately with references to questions
    questionsData.forEach((question, index) => {
        const imageInput = document.querySelector(`#question${question.number}Image`);
        if (imageInput && imageInput.files[0]) {
            formData.append(`questionImage_${question.number}`, imageInput.files[0]);
        }
    });

    // Submit form data...
    submitFormData(formData);
}

function submitFormData(formData) {
    // Show loading state
    const submitButton = document.querySelector('.btn-light');
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Submitting...';
    submitButton.disabled = true;

    // Submit to backend
    fetch('/quizzes', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Network response was not ok');
            });
        }
        return response.json();
    })
    .then(data => {
        // Show success message
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: 'Quiz created successfully',
                timer: 2000,
                showConfirmButton: false
            }).then(() => {
                window.location.href = '/quizzes';
            });
        } else {
            alert('Quiz created successfully!');
            window.location.href = '/quizzes';
        }
    })
    .catch(error => {
        console.error('Error:', error);
        // Show error message
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Error!',
                text: error.message || 'Failed to create quiz. Please try again.'
            });
        } else {
            alert(error.message || 'Failed to create quiz. Please try again.');
        }
    })
    .finally(() => {
        // Reset button state
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    });
}

// Add smooth scrolling when adding new questions
function moveQuestion(num, direction) {
    const currentCard = document.querySelector(`#question${num}`);
    const questions = document.querySelectorAll('.question-card');
    const currentIndex = Array.from(questions).indexOf(currentCard);
    
    if (direction === 'up' && currentIndex > 0) {
        currentCard.parentNode.insertBefore(currentCard, questions[currentIndex - 1]);
    } else if (direction === 'down' && currentIndex < questions.length - 1) {
        currentCard.parentNode.insertBefore(questions[currentIndex + 1], currentCard);
    }
    
    updateQuestionNumbers();
}

function deleteQuestion(num) {
    if (document.querySelectorAll('.question-card').length > 1) {
        if (confirm('Are you sure you want to delete this question?')) {
            document.querySelector(`#question${num}`).remove();
            updateQuestionNumbers();
        }
    } else {
        alert('Cannot delete the last question');
    }
}

function updateQuestionNumbers() {
    document.querySelectorAll('.question-card').forEach((card, index) => {
        const num = index + 1;
        card.id = `question${num}`;
        card.querySelector('.question-number').textContent = num;
        card.querySelector('h5').textContent = `Question ${num}`;
        
        // Update all IDs and data attributes
        updateElementAttributes(card, num);
    });
}

// Copy other functions from quiz_create.js
// toggleDateTimeSection()
// toggleAnswerOptions()
// previewImage()
// deleteImage()
// translateContent()
// previewQuiz()
// etc...