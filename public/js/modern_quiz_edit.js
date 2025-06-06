// Initialize
document.addEventListener('DOMContentLoaded', function() {
    setupAutoSave();
    updateQuestionCount();
});

function saveDraft() {
    return;
}

function isHasUnsavedChanges() {
    // Simple check - in real implementation, compare with original data
    return document.getElementById('quizTitle').value.trim() !== '';
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
            <button class="btn btn-outline-primary btn-sm preview-navigator-btn" 
                    id="nav-btn-${index + 1}"
                    onclick="scrollToPreviewQuestion(${index + 1})">
                ${index + 1}
            </button>`;
    });

    // Start mock timer
    startMockTimer();
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
    resetPreviewState();
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
        const questionsData = questions.map((question, index) => {
            // Get image src if exists
            const imgElement = document.querySelector(`#question-${index + 1} .image-upload-zone img`);
            const imageSrc = imgElement ? imgElement.src : null;

            return {
                number: index + 1,
                content: question.content,
                type: question.type,
                options: question.type === 'multiple_choice' 
                    ? question.options.map((text, optIndex) => ({
                        letter: String.fromCharCode(65 + optIndex), // A, B, C, D
                        text: text || ''
                    })).filter(opt => opt.text.trim())
                    : [],
                correctAnswer: question.correctAnswer || [],
                image: imageSrc
            };
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

// Expose functions for global access
window.addQuestion = addQuestion;
window.previewQuiz = previewQuiz;
window.editQuiz = editQuiz;
window.updateQuiz = updateQuiz;