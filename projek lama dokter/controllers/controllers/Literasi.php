<?php
class Literasi extends CI_Controller
{

    function __construct()
    {
        $aktif = $this->session->userdata('id_user');
        if (empty($aktif)) {
            redirect(site_url('Literasi'));
        }
        parent::__construct();

        $this->load->model('Baseweb_model', 'Baseweb');
    }

    public function index()
    {
        $data['peraturan'] = $this->Baseweb->getAturan();
        $this->template->load('template_literasi', 'literasi/dashboard_literasi', $data);
    }

    function aturan($id)
    {
        #Tambah data tabel peraturan
        $getData = $this->Baseweb->DataAturan($id);
        $data = array(
            'view' => $getData['view'] + 1
        );
        $this->Baseweb->Tambah_view_aturan($id, $data);

        #Tambah data pada kontrol literasi peraturan
        $id_user = $this->session->userdata('id_user');
        $kontrol = array(
            'id_user' => $id_user,
            'id_aturan' => $getData['id_peraturan']
        );
        $this->Baseweb->PostKontrolAturan($kontrol);

        $data['aturan'] = $getData;
        $this->template->load('template_literasi', 'literasi/baca_aturan', $data);
    }

    function materi()
    {
        $data['materi'] = $this->Baseweb->getMateri();
        $this->template->load('template_literasi', 'literasi/dashboard_materi', $data);
    }

    function baca_materi($id)
    {
        $getData = $this->Baseweb->DataMateri($id);
        $data = array(
            'view' => $getData['view'] + 1
        );
        $this->Baseweb->Tambah_view_materi($id, $data);

        #Tambah data pada kontrol literasi materi
        $id_user = $this->session->userdata('id_user');
        $kontrol = array(
            'id_user' => $id_user,
            'id_materi' => $getData['id_materi']
        );
        $this->Baseweb->PostKontrolMateri($kontrol);

        $data['materi'] = $getData;
        $this->template->load('template_literasi', 'literasi/baca_materi', $data);
    }

    function video()
    {
        $data['video'] = $this->Baseweb->getVideo();
        $this->template->load('template_literasi', 'literasi/dashboard_video', $data);
    }

    function lihat_video($id)
    {
        $getData = $this->Baseweb->DataVideo($id);
        $data = array(
            'view' => $getData['view'] + 1
        );
        $this->Baseweb->Tambah_view_video($id, $data);

        #Tambah data pada kontrol literasi peraturan
        $id_user = $this->session->userdata('id_user');
        $kontrol = array(
            'id_user' => $id_user,
            'id_video' => $getData['id_video']
        );
        $this->Baseweb->PostKontrolvideo($kontrol);

        $data['video'] = $getData;
        // $this->load->view('literasi/tonton_video', $data);
        $this->template->load('template_literasi', 'literasi/tonton_video', $data);
    }

    function logout()
    {
        $this->session->sess_destroy();
        $this->session->set_flashdata('status_login', 'Anda sudah berhasil keluar dari aplikasi');
        redirect(site_url('Baseweb'));
    }
}
