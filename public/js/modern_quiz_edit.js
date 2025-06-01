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
        // Ensure options is always an array of 4 strings for multiple_choice
        if (question.type === 'multiple_choice') {
            if (!Array.isArray(question.options) || question.options.length !== 4) {
                question.options = Array.isArray(question.options)
                    ? [...question.options, '', '', '', ''].slice(0, 4)
                    : ['', '', '', ''];
            }
        }
        if (field.startsWith('option')) {
            const index = field.charCodeAt(6) - 65; // Convert A,B,C,D to 0,1,2,3
            if (!Array.isArray(question.options)) {
                question.options = ['', '', '', ''];
            }
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
    if (addButton) {
        addButton.insertAdjacentHTML('beforebegin', questionHtml);
    } else {
        container.insertAdjacentHTML('beforeend', questionHtml);
    }
    updateQuestionCount();
    triggerAutoSave();
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

// Enhanced Create Question Function with Action Buttons
function createQuestionHtml(num) {
    return `
        <div class="question-card-modern animate-slide-up" id="question-${num}">
            <div class="question-header">
                <div class="d-flex align-items-center flex-grow-1">
                    <div class="question-number">${num}</div>
                    <h5 class="mb-0">Question ${num}</h5>
                </div>
                
                <!-- Action Buttons - Positioned outside the card -->
                <div class="question-actions">
                    <button class="action-btn" 
                            onclick="moveQuestion(${num}, 'up')" 
                            title="Move Up"
                            type="button">
                        <i class="fas fa-arrow-up"></i>
                    </button>
                    <button class="action-btn" 
                            onclick="moveQuestion(${num}, 'down')" 
                            title="Move Down"
                            type="button">
                        <i class="fas fa-arrow-down"></i>
                    </button>
                    <button class="action-btn" 
                            onclick="duplicateQuestion(${num})" 
                            title="Duplicate Question"
                            type="button">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="action-btn danger" 
                            onclick="deleteQuestion(${num})" 
                            title="Delete Question"
                            type="button">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            <div class="card-body-modern">
                <div class="row">
                    <div class="col-lg-8">
                        <div class="form-floating-modern">
                            <textarea class="form-control-modern" 
                                      id="question-${num}-content" 
                                      placeholder=" " 
                                      rows="3" 
                                      oninput="updateQuestion(${num}, 'content', this.value)"></textarea>
                            <label class="form-label-modern">Question Content</label>
                        </div>
                        
                        <div class="form-floating-modern">
                            <select class="form-control-modern" 
                                    id="question-${num}-type" 
                                    onchange="toggleQuestionType(${num}, this.value)">
                                <option value="multiple_choice">Multiple Choice A/B/C/D</option>
                                <option value="text_input">Text Input</option>
                            </select>
                            <label class="form-label-modern">Question Type</label>
                        </div>
                    </div>
                    
                    <div class="col-lg-4">
                        <div class="image-upload-zone" onclick="document.getElementById('image-${num}').click()">
                            <input type="file" 
                                   id="image-${num}" 
                                   accept="image/*" 
                                   style="display: none;" 
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
        text: `Are you sure you want to delete Question ${num}? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Delete Question',
        cancelButtonText: 'Cancel',
        customClass: {
            popup: 'swal-modern'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const element = document.getElementById(`question-${num}`);
            if (element) {
                // Add exit animation
                element.style.animation = 'fadeOut 0.3s ease-out';
                
                setTimeout(() => {
                    element.remove();
                    questions = questions.filter(q => q.id !== num);
                    renumberQuestions();
                    updateQuestionCount();
                    triggerAutoSave();
                }, 300);
                
                Swal.fire({
                    title: 'Deleted!',
                    text: 'Question has been deleted successfully.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false,
                    customClass: {
                        popup: 'swal-modern'
                    }
                });
            }
        }
    });
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
        showNotification(
            `Cannot move ${direction}. Question is already at the ${direction === 'up' ? 'top' : 'bottom'}.`,
            'warning'
        );
        return;
    }

    // Swap in DOM
    const targetElement = allQuestions[targetIndex];
    if (direction === 'up') {
        container.insertBefore(questionElement, targetElement);
    } else {
        container.insertBefore(questionElement, targetElement.nextSibling);
    }

    // Swap in questions array
    const idx = questions.findIndex(q => q.id === num);
    if (idx !== -1) {
        if (direction === 'up' && idx > 0) {
            [questions[idx - 1], questions[idx]] = [questions[idx], questions[idx - 1]];
        } else if (direction === 'down' && idx < questions.length - 1) {
            [questions[idx], questions[idx + 1]] = [questions[idx + 1], questions[idx]];
        }
    }

    // Renumber and save
    renumberQuestions();
    triggerAutoSave();
    showNotification(`Question moved ${direction} successfully!`, 'success');
}

function duplicateQuestion(num) {
    const originalQuestion = questions.find(q => q.id === num);
    if (originalQuestion) {
        questionCount++;
        const newQuestion = {
            ...originalQuestion,
            id: questionCount,
            content: originalQuestion.content + ' (Copy)'
        };
        questions.push(newQuestion);
        
        const questionHtml = createQuestionHtml(questionCount);
        const originalElement = document.getElementById(`question-${num}`);
        originalElement.insertAdjacentHTML('afterend', questionHtml);
        
        // Populate the duplicated question data
        setTimeout(() => {
            const contentElement = document.getElementById(`question-${questionCount}-content`);
            if (contentElement) {
                contentElement.value = newQuestion.content;
                contentElement.dispatchEvent(new Event('input'));
            }
            
            // Set question type
            const typeElement = document.getElementById(`question-${questionCount}-type`);
            if (typeElement) {
                typeElement.value = originalQuestion.type;
                toggleQuestionType(questionCount, originalQuestion.type);
            }
            
            // Copy options if multiple choice
            if (originalQuestion.type === 'multiple_choice') {
                ['A', 'B', 'C', 'D'].forEach((letter, index) => {
                    const optionInput = document.getElementById(`option-${questionCount}-${letter}`);
                    if (optionInput && originalQuestion.options[index]) {
                        optionInput.value = originalQuestion.options[index];
                        updateQuestion(questionCount, `option${letter}`, originalQuestion.options[index]);
                    }
                });
                
                if (originalQuestion.correctAnswer) {
                    selectCorrectAnswer(questionCount, originalQuestion.correctAnswer);
                }
            }
        }, 100);
        
        updateQuestionCount();
        triggerAutoSave();
        
        showNotification('Question duplicated successfully!', 'success');
        
        // Scroll to new question
        setTimeout(() => {
            const element = document.getElementById(`question-${questionCount}`);
            if (element) {
                element.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }, 200);
    }
}

// Function to renumber questions after reordering
function renumberQuestions() {
    const questionElements = document.querySelectorAll('.question-card-modern');
    questionElements.forEach((element, index) => {
        const newNum = index + 1;
        
        // Update element ID
        element.id = `question-${newNum}`;
        
        // Update question number display
        const numberDisplay = element.querySelector('.question-number');
        if (numberDisplay) numberDisplay.textContent = newNum;
        
        // Update heading
        const heading = element.querySelector('h5');
        if (heading) heading.textContent = `Question ${newNum}`;
        
        // Update all form element IDs and event handlers
        updateQuestionElementIds(element, newNum);
        
        // Update questions array
        if (questions[index]) {
            questions[index].id = newNum;
        }
    });
    
    questionCount = questionElements.length;
}

// Helper function to update element IDs and handlers
function updateQuestionElementIds(element, newNum) {
    // Update textarea
    const textarea = element.querySelector('textarea');
    if (textarea) {
        textarea.id = `question-${newNum}-content`;
        textarea.setAttribute('oninput', `updateQuestion(${newNum}, 'content', this.value)`);
    }
    
    // Update select
    const select = element.querySelector('select');
    if (select) {
        select.id = `question-${newNum}-type`;
        select.setAttribute('onchange', `toggleQuestionType(${newNum}, this.value)`);
    }
    
    // Update file input
    const fileInput = element.querySelector('input[type="file"]');
    if (fileInput) {
        fileInput.id = `image-${newNum}`;
        fileInput.setAttribute('onchange', `handleImageUpload(${newNum}, this)`);
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
        
        // Update option inputs and radios
        const optionInputs = optionsContainer.querySelectorAll('input[type="text"]');
        optionInputs.forEach((input, index) => {
            const letter = String.fromCharCode(65 + index); // A, B, C, D
            input.id = `option-${newNum}-${letter}`;
            input.setAttribute('oninput', `updateQuestion(${newNum}, 'option${letter}', this.value)`);
        });
        
        const radioButtons = optionsContainer.querySelectorAll('.option-radio');
        radioButtons.forEach((radio, index) => {
            const letter = String.fromCharCode(65 + index); // A, B, C, D
            radio.id = `radio-${newNum}-${letter}`;
            radio.setAttribute('onclick', `selectCorrectAnswer(${newNum}, '${letter}')`);
        });
    }
}

// Notification function
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 9999;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        max-width: 300px;
        animation: slideInRight 0.3s ease-out;
    `;
    
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    notification.style.background = colors[type] || colors.info;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; transform: scale(1); }
        to { opacity: 0; transform: scale(0.9); }
    }
`;
document.head.appendChild(style);

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