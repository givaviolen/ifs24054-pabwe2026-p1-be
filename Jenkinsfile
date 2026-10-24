pipeline {
  agent any

  options {
    timestamps()
    timeout(time: 15, unit: 'MINUTES')
  }

  environment {
    // Pastikan Bun ada di PATH agent Jenkins (lihat README)
    PATH = "${env.HOME}/.bun/bin:${env.PATH}"
    DB_PATH = ':memory:' // SQLite in-memory saat testing: tanpa server DB eksternal
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Verifikasi Bun') {
      steps { sh 'bun --version' }
    }

    stage('Install Dependencies') {
      steps { sh 'bun install' }
    }

    stage('Test') {
      steps { sh 'bun test' }
    }
  }

  post {
    success { echo 'Pipeline sukses: seluruh test Back-End lulus.' }
    failure { echo 'Pipeline gagal: periksa Console Output.' }
  }
}
