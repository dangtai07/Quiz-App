// Modern Quiz Edit JavaScript
let autoSaveTimer;
let previewTimer;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    setupAutoSave();
    updateQuestionCount();
    initializeTooltips();
    
    // Log initialization info
    console.log('Quiz edit initialized with', questionCount, 'questions');
    console.log('Quiz ID:', quizId);
});

// =================== AUTO-SAVE FUNCTIONALITY ===================

function setupAutoSave() {
    // Auto-save every 30 seconds
    setInterval(() => {
        if (hasUnsavedChanges()) {
            saveDraft();
        }
    }, 30000);
    
    // Save on quiz title change
    document.getElementById('quizTitle').addEventListener('input', () => {
        triggerAutoSave();
    });
    
    // Save on mode/language change
    document.getElementById('quizMode').addEventListener('change', () => {
        triggerAutoSave();
    });
    
    document.getElementById('quizLanguage').addEventListener('change', () => {
        triggerAutoSave();
    });
}

function triggerAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        saveDraft();
    }, 2000);
}

function saveDraft() {
    // Show auto-save indicator
    showAutoSaveIndicator();
    
    // In a real implementation, you might save to localStorage or send to server
    console.log('Draft saved automatically');
}

function showAutoSaveIndicator() {
    const indicator = document.getElementById('autoSaveIndicator');
    if (indicator) {
        indicator.classList.add('show');
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
    }
}

function hasUnsavedChanges() {
    // Simple check - in real implementation, compare with original data
    return document.getElementById('quizTitle').value.trim() !== '';
}

// =================== QUIZ INFO MANAGEMENT ===================

function toggleScheduleSettings() {
    const mode = document.getElementById('quizMode').value;
    const scheduleSettings = document.getElementById('scheduleSettings');
    
    if (mode === 'offline') {
        scheduleSettings.style.display = 'block';
    } else {
        scheduleSettings.style.display = 'none';
    }
    triggerAutoSave();
}

// =================== QUESTION MANAGEMENT ===================

function updateQuestion(num, field, value) {
    const question = questions.find(q => q.id === num);
    if (question) {
        if (field.startsWith('option')) {
            const index = field.charCodeAt(6) - 65; // Convert A,B,C,D to 0,1,2,3
            question.options[index] = value;
        } else {
            question[field] = value;
        }
        triggerAutoSave();
    }
}

function selectCorrectAnswer(questionNum, letter) {
    // Clear all selections for this question
    const letters = ['A', 'B', 'C', 'D'];
    letters.forEach(l => {
        const radioElement = document.getElementById(`radio-${questionNum}-${l}`);
        if (radioElement) {
            radioElement.classList.remove('checked');
        }
    });
    
    // Select the clicked option
    const selectedRadio = document.getElementById(`radio-${questionNum}-${letter}`);
    if (selectedRadio) {
        selectedRadio.classList.add('checked');
    }
    
    // Update question data
    updateQuestion(questionNum, 'correctAnswer', letter);
}

function toggleQuestionType(num, type) {
    const optionsContainer = document.getElementById(`options-${num}`);
    updateQuestion(num, 'type', type);
    
    if (type === 'text_input') {
        optionsContainer.innerHTML = `
            <h6 class="text-primary mb-3">Text Answer Settings</h6>
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                Students will type their answer in a text field.
            </div>
        `;
    } else {
        optionsContainer.innerHTML = `
            <h6 class="text-primary mb-3">Answer Options</h6>
            ${createOptionsHtml(num)}
        `;
        
        // Restore saved values
        const question = questions.find(q => q.id === num);
        if (question) {
            ['A', 'B', 'C', 'D'].forEach((letter, index) => {
                const input = document.getElementById(`option-${num}-${letter}`);
                if (input && question.options[index]) {
                    input.value = question.options[index];
                }
            });
            
            if (question.correctAnswer) {
                selectCorrectAnswer(num, question.correctAnswer);
            }
        }
    }
}

function createOptionsHtml(questionNum) {
    const letters = ['A', 'B', 'C', 'D'];
    return letters.map(letter => `
        <div class="option-group">
            <div class="option-radio" id="radio-${questionNum}-${letter}" 
                 onclick="selectCorrectAnswer(${questionNum}, '${letter}')"></div>
            <div class="option-letter">${letter}</div>
            <input type="text" class="form-control-modern flex-grow-1" 
                   placeholder="Enter option ${letter}" 
                   id="option-${questionNum}-${letter}"
                   oninput="updateQuestion(${questionNum}, 'option${letter}', this.value)">
        </div>
    `).join('');
}

function addQuestion() {
    questionCount++;
    const newQuestion = {
        id: questionCount,
        type: 'multiple_choice',
        content: '',
        options: ['', '', '', ''],
        correctAnswer: '',
        image: null
    };
    
    questions.push(newQuestion);
    
    const questionHtml = createQuestionHtml(questionCount);
    const container = document.getElementById('questionsContainer');
    const addButton = container.querySelector('.add-question-btn');
    addButton.insertAdjacentHTML('beforebegin', questionHtml);
    
    updateQuestionCount();
    triggerAutoSave();
    
    // Scroll to new question
    setTimeout(() => {
        const element = document.getElementById(`question-${questionCount}`);
        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, 100);
}

function createQuestionHtml(num) {
    return `
        <div class="question-card-modern animate-slide-up" id="question-${num}">
            <div class="question-header">
                <div class="d-flex align-items-center flex-grow-1">
                    <div class="question-number">${num}</div>
                    <h5 class="mb-0">Question ${num}</h5>
                </div>
                <div class="question-actions">
                    <button class="action-btn" onclick="moveQuestion(${num}, 'up')" title="Move Up">
                        <i class="fas fa-arrow-up"></i>
                    </button>
                    <button class="action-btn" onclick="moveQuestion(${num}, 'down')" title="Move Down">
                        <i class="fas fa-arrow-down"></i>
                    </button>
                    <button class="action-btn" onclick="duplicateQuestion(${num})" title="Duplicate">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="action-btn danger" onclick="deleteQuestion(${num})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="card-body-modern">
                <div class="row">
                    <div class="col-lg-8">
                        <div class="form-floating-modern">
                            <textarea class="form-control-modern" id="question-${num}-content" 
                                      placeholder=" " rows="3" 
                                      oninput="updateQuestion(${num}, 'content', this.value)"></textarea>
                            <label class="form-label-modern">Question Content</label>
                        </div>
                        
                        <div class="form-floating-modern">
                            <select class="form-control-modern" id="question-${num}-type" 
                                    onchange="toggleQuestionType(${num}, this.value)">
                                <option value="multiple_choice">Multiple Choice A/B/C/D</option>
                                <option value="text_input">Text Input</option>
                            </select>
                            <label class="form-label-modern">Question Type</label>
                        </div>
                    </div>
                    <div class="col-lg-4">
                        <div class="image-upload-zone" onclick="document.getElementById('image-${num}').click()">
                            <input type="file" id="image-${num}" accept="image/*" style="display: none;" 
                                   onchange="handleImageUpload(${num}, this)">
                            <div class="upload-content">
                                <div class="upload-icon">
                                    <i class="fas fa-cloud-upload-alt"></i>
                                </div>
                                <h6>Upload Image</h6>
                                <p class="text-muted small mb-0">Click to select image</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="answer-options" id="options-${num}">
                    <h6 class="text-primary mb-3">Answer Options</h6>
                    ${createOptionsHtml(num)}
                </div>
            </div>
        </div>
    `;
}

function deleteQuestion(num) {
    Swal.fire({
        title: 'Delete Question?',
        text: "This action cannot be undone.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
        if (result.isConfirmed) {
            const element = document.getElementById(`question-${num}`);
            if (element) {
                element.remove();
            }
            
            // Remove from questions array
            questions = questions.filter(q => q.id !== num);
            
            // Update question numbers and renumber remaining questions
            renumberQuestions();
            
            updateQuestionCount();
            triggerAutoSave();
            
            Swal.fire({
                title: 'Deleted!',
                text: 'Question has been deleted.',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
        }
    });
}

function renumberQuestions() {
    const questionElements = document.querySelectorAll('.question-card-modern');
    questionElements.forEach((element, index) => {
        const newNum = index + 1;
        const oldId = element.id;
        
        // Update element ID
        element.id = `question-${newNum}`;
        
        // Update question number display
        const numberDisplay = element.querySelector('.question-number');
        if (numberDisplay) {
            numberDisplay.textContent = newNum;
        }
        
        // Update heading
        const heading = element.querySelector('h5');
        if (heading) {
            heading.textContent = `Question ${newNum}`;
        }
        
        // Update all IDs and onclick handlers within this question
        updateQuestionElementIds(element, newNum);
        
        // Update the question object ID
        if (questions[index]) {
            questions[index].id = newNum;
        }
    });
    
    // Update global question count
    questionCount = questionElements.length;
}

function updateQuestionElementIds(element, newNum) {
    // Update content textarea
    const contentTextarea = element.querySelector('textarea');
    if (contentTextarea) {
        contentTextarea.id = `question-${newNum}-content`;
        contentTextarea.setAttribute('oninput', `updateQuestion(${newNum}, 'content', this.value)`);
    }
    
    // Update type select
    const typeSelect = element.querySelector('select');
    if (typeSelect) {
        typeSelect.id = `question-${newNum}-type`;
        typeSelect.setAttribute('onchange', `toggleQuestionType(${newNum}, this.value)`);
    }
    
    // Update image input
    const imageInput = element.querySelector('input[type="file"]');
    if (imageInput) {
        imageInput.id = `image-${newNum}`;
        imageInput.setAttribute('onchange', `handleImageUpload(${newNum}, this)`);
    }
    
    // Update image upload zone
    const uploadZone = element.querySelector('.image-upload-zone');
    if (uploadZone) {
        uploadZone.setAttribute('onclick', `document.getElementById('image-${newNum}').click()`);
    }
    
    // Update action buttons
    const actionButtons = element.querySelectorAll('.action-btn');
    actionButtons.forEach(button => {
        const icon = button.querySelector('i');
        if (icon) {
            if (icon.classList.contains('fa-arrow-up')) {
                button.setAttribute('onclick', `moveQuestion(${newNum}, 'up')`);
            } else if (icon.classList.contains('fa-arrow-down')) {
                button.setAttribute('onclick', `moveQuestion(${newNum}, 'down')`);
            } else if (icon.classList.contains('fa-copy')) {
                button.setAttribute('onclick', `duplicateQuestion(${newNum})`);
            } else if (icon.classList.contains('fa-trash')) {
                button.setAttribute('onclick', `deleteQuestion(${newNum})`);
            }
        }
    });
    
    // Update options container
    const optionsContainer = element.querySelector('.answer-options');
    if (optionsContainer) {
        optionsContainer.id = `options-${newNum}`;
        
        // Update option radios and inputs
        const optionRadios = optionsContainer.querySelectorAll('.option-radio');
        optionRadios.forEach((radio, index) => {
            const letter = String.fromCharCode(65 + index); // A, B, C, D
            radio.id = `radio-${newNum}-${letter}`;
            radio.setAttribute('onclick', `selectCorrectAnswer(${newNum}, '${letter}')`);
        });
        
        const optionInputs = optionsContainer.querySelectorAll('input[type="text"]');
        optionInputs.forEach((input, index) => {
            const letter = String.fromCharCode(65 + index); // A, B, C, D
            input.id = `option-${newNum}-${letter}`;
            input.setAttribute('oninput', `updateQuestion(${newNum}, 'option${letter}', this.value)`);
        });
    }
}

function duplicateQuestion(num) {
    const originalQuestion = questions.find(q => q.id === num);
    if (originalQuestion) {
        questionCount++;
        const newQuestion = {
            ...originalQuestion,
            id: questionCount
        };
        questions.push(newQuestion);
        
        const questionHtml = createQuestionHtml(questionCount);
        const originalElement = document.getElementById(`question-${num}`);
        originalElement.insertAdjacentHTML('afterend', questionHtml);
        
        // Populate the duplicated question data
        setTimeout(() => {
            const contentElement = document.getElementById(`question-${questionCount}-content`);
            if (contentElement) {
                contentElement.value = originalQuestion.content;
                contentElement.dispatchEvent(new Event('input'));
            }
            
            // Set question type
            const typeElement = document.getElementById(`question-${questionCount}-type`);
            if (typeElement) {
                typeElement.value = originalQuestion.type;
                toggleQuestionType(questionCount, originalQuestion.type);
            }
        }, 100);
        
        updateQuestionCount();
        triggerAutoSave();
    }
}

function moveQuestion(num, direction) {
    const questionElement = document.getElementById(`question-${num}`);
    if (!questionElement) return;
    
    const container = document.getElementById('questionsContainer');
    const allQuestions = Array.from(container.children).filter(child => 
        child.classList.contains('question-card-modern')
    );
    const currentIndex = allQuestions.indexOf(questionElement);
    
    let targetIndex;
    if (direction === 'up' && currentIndex > 0) {
        targetIndex = currentIndex - 1;
    } else if (direction === 'down' && currentIndex < allQuestions.length - 1) {
        targetIndex = currentIndex + 1;
    } else {
        return; // Can't move
    }
    
    const targetElement = allQuestions[targetIndex];
    
    if (direction === 'up') {
        container.insertBefore(questionElement, targetElement);
    } else {
        container.insertBefore(questionElement, targetElement.nextSibling);
    }
    
    // Renumber questions after moving
    renumberQuestions();
    
    triggerAutoSave();
}

function handleImageUpload(num, input) {
    const file = input.files[0];
    if (file) {
        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            Swal.fire({
                icon: 'error',
                title: 'File Too Large',
                text: 'Image must be less than 5MB',
                confirmButtonColor: '#667eea'
            });
            input.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const uploadZone = input.parentElement;
            uploadZone.classList.add('has-image');
            uploadZone.innerHTML = `
                <img src="${e.target.result}" alt="Question Image" 
                     style="max-width: 100%; max-height: 200px; border-radius: 8px;">
                <div class="mt-2">
                    <button class="btn btn-sm btn-outline-danger" 
                            onclick="removeImage(${num})" type="button">
                        <i class="fas fa-trash me-1"></i> Remove
                    </button>
                </div>
            `;
            updateQuestion(num, 'image', {
                file: file,
                preview: e.target.result
            });
        };
        reader.readAsDataURL(file);
    }
}

function removeImage(num) {
    const uploadZone = document.querySelector(`#question-${num} .image-upload-zone`);
    const fileInput = document.getElementById(`image-${num}`);
    
    uploadZone.classList.remove('has-image');
    uploadZone.innerHTML = `
        <input type="file" id="image-${num}" accept="image/*" style="display: none;" 
               onchange="handleImageUpload(${num}, this)">
        <div class="upload-content">
            <div class="upload-icon">
                <i class="fas fa-cloud-upload-alt"></i>
            </div>
            <h6>Upload Image</h6>
            <p class="text-muted small mb-0">Click to select image</p>
        </div>
    `;
    
    // Update onclick handler
    uploadZone.setAttribute('onclick', `document.getElementById('image-${num}').click()`);
    
    if (fileInput) {
        fileInput.value = '';
    }
    
    updateQuestion(num, 'image', null);
}

function updateQuestionCount() {
    const countElement = document.getElementById('questionCount');
    const displayElement = document.getElementById('questionCountDisplay');
    
    if (countElement) {
        countElement.textContent = questions.length;
    }
    
    if (displayElement) {
        displayElement.textContent = questions.length;
    }
}

// =================== PREVIEW FUNCTIONALITY ===================

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
    const previewContainer = document.getElementById('previewQuestionsContainer');
    const navigator = document.getElementById('previewNavigator');
    
    questions.forEach((question, index) => {
        // Create question preview
        let questionHTML = `
            <div class="preview-question p-4 mb-4" id="previewQuestion${index + 1}">
                <div class="d-flex align-items-start">
                    <div class="question-counter me-3">${index + 1}</div>
                    <div class="flex-grow-1">
                        <h5 class="mb-3">${question.content || 'Untitled Question'}</h5>`;
        
        // Add image if exists
        if (question.image) {
            let imageSrc = '';
            if (question.image.preview) {
                imageSrc = question.image.preview;
            } else if (typeof question.image === 'string' && question.image.startsWith('data:')) {
                imageSrc = question.image;
            }
            
            if (imageSrc) {
                questionHTML += `
                    <div class="mb-3 text-center">
                        <img src="${imageSrc}" alt="Question Image" class="img-fluid rounded" style="max-height: 300px;">
                    </div>`;
            }
        }
        
        // Add answer options
        if (question.type === 'multiple_choice') {
            questionHTML += '<div class="preview-options">';
            ['A', 'B', 'C', 'D'].forEach((letter, optIndex) => {
                const optionText = question.options[optIndex];
                if (optionText && optionText.trim()) {
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
            <button class="btn btn-outline-primary btn-sm" onclick="scrollToPreviewQuestion(${index + 1})">
                ${index + 1}
            </button>`;
    });

    // Start mock timer
    startMockTimer();
}

function scrollToPreviewQuestion(num) {
    const element = document.getElementById(`previewQuestion${num}`);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
}

function selectPreviewOption(element, questionNum) {
    const parent = element.closest('.preview-options');
    if (parent) {
        parent.querySelectorAll('.preview-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        element.classList.add('selected');
        updatePreviewProgress();
    }
}

function updatePreviewProgress() {
    const total = document.querySelectorAll('.preview-question').length;
    const answered = document.querySelectorAll('.preview-option.selected').length;
    const progress = total > 0 ? (answered / total) * 100 : 0;
    
    const progressBar = document.getElementById('previewProgress');
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
        progressBar.setAttribute('aria-valuenow', progress);
    }
}

function startMockTimer() {
    if (previewTimer) clearInterval(previewTimer);
    
    let time = 45 * 60; // 45 minutes
    const timerEl = document.getElementById('previewTimer');
    
    previewTimer = setInterval(() => {
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        
        if (timerEl) {
            timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        if (--time < 0) {
            clearInterval(previewTimer);
            if (timerEl) {
                timerEl.textContent = '00:00';
            }
        }
    }, 1000);
}

function editQuiz() {
    // Close the preview modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('previewModal'));
    if (modal) {
        modal.hide();
    }
    
    // Scroll back to the top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Reset timer when modal is closed
document.getElementById('previewModal').addEventListener('hidden.bs.modal', function () {
    if (previewTimer) clearInterval(previewTimer);
});

// =================== UPDATE FUNCTIONALITY ===================

async function updateQuiz() {
    try {
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

        // Collect questions data
        const questionsData = questions.map((question, index) => ({
            number: index + 1,
            content: question.content,
            type: question.type,
            options: question.type === 'multiple_choice' 
                ? question.options.map((text, optIndex) => ({
                    letter: String.fromCharCode(65 + optIndex), // A, B, C, D
                    text: text || ''
                })).filter(opt => opt.text.trim())
                : [],
            correctAnswer: question.correctAnswer || []
        }));

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

        // Add image files separately
        questions.forEach((question, index) => {
            if (question.image && question.image.file) {
                formData.append(`questionImage_${index + 1}`, question.image.file);
            }
        });

        // Show loading state
        Swal.fire({
            title: 'Updating Quiz...',
            text: 'Please wait while we save your changes.',
            allowOutsideClick: false,
            showConfirmButton: false,
            willOpen: () => {
                Swal.showLoading();
            }
        });

        const response = await fetch(`/quizzes/${quizId}`, {
            method: 'PUT',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update quiz');
        }

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
        console.error('Update quiz error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error!',
            text: error.message || 'Failed to update quiz. Please try again.',
            confirmButtonColor: '#667eea'
        });
    }
}

// =================== UTILITY FUNCTIONS ===================

function initializeTooltips() {
    // Initialize tooltips for action buttons
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[title]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Expose functions for global access
window.toggleScheduleSettings = toggleScheduleSettings;
window.updateQuestion = updateQuestion;
window.selectCorrectAnswer = selectCorrectAnswer;
window.toggleQuestionType = toggleQuestionType;
window.addQuestion = addQuestion;
window.deleteQuestion = deleteQuestion;
window.duplicateQuestion = duplicateQuestion;
window.moveQuestion = moveQuestion;
window.handleImageUpload = handleImageUpload;
window.removeImage = removeImage;
window.previewQuiz = previewQuiz;
window.editQuiz = editQuiz;
window.updateQuiz = updateQuiz;
window.scrollToPreviewQuestion = scrollToPreviewQuestion;
window.selectPreviewOption = selectPreviewOption;