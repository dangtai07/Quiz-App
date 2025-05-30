let questionCount = 2;
let previewTimer;

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
        Swal.fire({
            icon: 'warning',
            title: 'Missing Title',
            text: 'Please enter a quiz title'
        });
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
                    Swal.fire({
                        icon: 'warning',
                        title: 'Invalid Options',
                        text: `Question ${index + 1} must have at least 2 options`
                    });
                    return;
                }
                if (!questionData.correctAnswer) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Missing Answer',
                        text: `Please select correct answer for question ${index + 1}`
                    });
                    return;
                }
            }

            questionsData.push(questionData);
        }
    });

    // Validate questions array
    if (questionsData.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'No Questions',
            text: 'Please add at least one question'
        });
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
        Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: 'Quiz created successfully',
            timer: 2000,
            showConfirmButton: false
        }).then(() => {
            window.location.href = '/quizzes';
        });
    })
    .catch(error => {
        Swal.fire({
            icon: 'error',
            title: 'Error!',
            text: error.message || 'Failed to create quiz. Please try again.'
        });
    })
    .finally(() => {
        // Reset button state
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    });
}

// Add smooth scrolling when adding new questions
function addQuestion() {
    questionCount++;
    const container = document.getElementById('questionsContainer');
    
    const newQuestionHTML = `
        <div class="card question-card">
            <div class="card-header d-flex align-items-center">
                <div class="d-flex align-items-center">
                    <div class="question-number me-3">${questionCount}</div>
                    <h5 class="mb-0">Question ${questionCount}</h5>
                </div>
                <div class="question-actions">
                    <div class="btn-group-vertical action-buttons">
                        <button type="button" class="btn btn-outline-secondary btn-sm" 
                                onclick="moveQuestion(${questionCount}, 'up')" 
                                title="Move Up">
                            <i class="fas fa-arrow-up"></i>
                        </button>
                        <button type="button" class="btn btn-outline-secondary btn-sm" 
                                onclick="moveQuestion(${questionCount}, 'down')" 
                                title="Move Down">
                            <i class="fas fa-arrow-down"></i>
                        </button>
                        <button type="button" class="btn btn-outline-secondary btn-sm" 
                                onclick="translateContent(${questionCount})" 
                                title="Translate">
                            <i class="fas fa-language"></i>
                        </button>
                        <button type="button" class="btn btn-outline-secondary btn-sm" 
                                onclick="deleteQuestion(${questionCount})" 
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
                            <label for="question${questionCount}Content" class="form-label fw-semibold">Question Content *</label>
                            <textarea class="form-control" id="question${questionCount}Content" rows="3" placeholder="Enter your question here..."></textarea>
                        </div>
                        
                        <div class="mb-3">
                            <label for="question${questionCount}Type" class="form-label fw-semibold">Question Type *</label>
                            <select class="form-select" id="question${questionCount}Type" onchange="toggleAnswerOptions(${questionCount})">
                                <option value="multiple_choice">Multiple Choice A/B/C/D</option>
                                <option value="text_input">Text Input</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="col-md-4">
                        <div class="mb-3">
                            <label for="question${questionCount}Image" class="form-label fw-semibold">Question Image</label>
                            <input type="file" class="form-control" id="question${questionCount}Image" accept="image/*" onchange="previewImage(${questionCount})">
                        </div>
                        <div id="imagePreview${questionCount}" class="image-preview">
                            <i class="fas fa-image fa-2x text-muted mb-2"></i>
                            <div class="text-muted small">Image preview will appear here</div>
                        </div>
                    </div>
                </div>
                
                <div id="answerOptions${questionCount}">
                    <h6 class="text-primary mb-3">Answer Options</h6>
                    <div class="row g-3">
                        <div class="col-md-6">
                            <div class="input-group">
                                <span class="input-group-text">
                                    <input type="radio" name="correctAnswer${questionCount}" value="A" class="form-check-input">
                                </span>
                                <span class="input-group-text fw-bold">A</span>
                                <input type="text" class="form-control" placeholder="Option A" id="question${questionCount}OptionA">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="input-group">
                                <span class="input-group-text">
                                    <input type="radio" name="correctAnswer${questionCount}" value="B" class="form-check-input">
                                </span>
                                <span class="input-group-text fw-bold">B</span>
                                <input type="text" class="form-control" placeholder="Option B" id="question${questionCount}OptionB">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="input-group">
                                <span class="input-group-text">
                                    <input type="radio" name="correctAnswer${questionCount}" value="C" class="form-check-input">
                                </span>
                                <span class="input-group-text fw-bold">C</span>
                                <input type="text" class="form-control" placeholder="Option C" id="question${questionCount}OptionC">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="input-group">
                                <span class="input-group-text">
                                    <input type="radio" name="correctAnswer${questionCount}" value="D" class="form-check-input">
                                </span>
                                <span class="input-group-text fw-bold">D</span>
                                <input type="text" class="form-control" placeholder="Option D" id="question${questionCount}OptionD">
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
    
    container.insertAdjacentHTML('beforeend', newQuestionHTML);
    
    // Smooth scroll to new question
    setTimeout(() => {
        const newQuestion = container.lastElementChild;
        newQuestion.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
}

function moveQuestion(questionNum, direction) {
    const container = document.getElementById('questionsContainer');
    const questions = container.children;
    const currentQuestion = questions[questionNum - 1];
    
    if (direction === 'up' && questionNum > 1) {
        const previousQuestion = questions[questionNum - 2];
        container.insertBefore(currentQuestion, previousQuestion);
        updateQuestionNumbers();
    } else if (direction === 'down' && questionNum < questions.length) {
        const nextQuestion = questions[questionNum];
        container.insertBefore(nextQuestion, currentQuestion);
        updateQuestionNumbers();
    }
}

function deleteQuestion(questionNum) {
    if (confirm(`Are you sure you want to delete question ${questionNum}?`)) {
        const questionCard = document.querySelector(`#questionsContainer .card:nth-child(${questionNum})`);
        questionCard.remove();
        questionCount--;
        
        // Cập nhật lại số thứ tự các câu hỏi
        updateQuestionNumbers();
    }
}

function updateQuestionNumbers() {
    const questions = document.querySelectorAll('#questionsContainer .card');
    questions.forEach((question, index) => {
        // Cập nhật số thứ tự hiển thị
        const numberDiv = question.querySelector('.question-number');
        numberDiv.textContent = index + 1;
        
        // Cập nhật tiêu đề câu hỏi
        const titleEl = question.querySelector('h5');
        titleEl.textContent = `Question ${index + 1}`;
        
        // Cập nhật ID và name các trường input
        const content = question.querySelector('textarea[id^="question"]');
        const type = question.querySelector('select[id^="question"]');
        const image = question.querySelector('input[type="file"]');
        const imagePreview = question.querySelector('div[id^="imagePreview"]');
        const options = question.querySelectorAll('input[id^="question"][type="text"]');
        const radios = question.querySelectorAll('input[type="radio"]');
        
        content.id = `question${index + 1}Content`;
        type.id = `question${index + 1}Type`;
        image.id = `question${index + 1}Image`;
        imagePreview.id = `imagePreview${index + 1}`;
        
        options.forEach((option, optIndex) => {
            const letter = String.fromCharCode(65 + optIndex); // A, B, C, D
            option.id = `question${index + 1}Option${letter}`;
        });
        
        radios.forEach(radio => {
            radio.name = `correctAnswer${index + 1}`;
        });

        // 4. Cập nhật onclick cho các nút
        const actionButtons = question.querySelectorAll('.action-buttons button');
        actionButtons.forEach(button => {
            const icon = button.querySelector('i');
            if (!icon) return;

            if (icon.classList.contains('fa-arrow-up')) {
                button.setAttribute('onclick', `moveQuestion(${index + 1}, 'up')`);
            } else if (icon.classList.contains('fa-arrow-down')) {
                button.setAttribute('onclick', `moveQuestion(${index + 1}, 'down')`);
            } else if (icon.classList.contains('fa-language')) {
                button.setAttribute('onclick', `translateContent(${index + 1})`);
            } else if (icon.classList.contains('fa-trash')) {
                button.setAttribute('onclick', `deleteQuestion(${index + 1})`);
            }
        });
    });
}